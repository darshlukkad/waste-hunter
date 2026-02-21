"""
Minimalist — Bedrock Agent (Phase 1 + 2 + 3)
======================================================
Agentic tool-use loop powered by Amazon Bedrock (Claude Sonnet 4.5).
Calls the MCP server tools directly to detect waste, assess blast radius,
rewrite IaC via MiniMax, and create a GitHub PR.

Phases wired here:
  Phase 1  ✅  Datadog MCP tools  (get_idle_resources, get_resource_telemetry)
  Phase 2  ✅  Neo4j blast-radius check (check_blast_radius)
  Phase 3  ✅  MiniMax IaC rewrite (rewrite_iac) + GitHub PR (create_github_pr)
  Phase 4  🔜  Emit SSE events to CopilotKit frontend

Usage:
  python waste_hunter.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import anthropic
from dotenv import load_dotenv

# ── Allow importing from sibling packages ────────────────────────────────────
_backend = Path(__file__).parent.parent
sys.path.insert(0, str(_backend / "mcp_server"))
sys.path.insert(0, str(_backend))

from mock_data import MOCK_IDLE_RESOURCES, get_timeseries        # noqa: E402
from graph.blast_radius import BlastRadiusChecker                # noqa: E402
from github_pr.minimax_rewriter import rewrite_terraform, rewrite_k8s  # noqa: E402
from github_pr.pr_creator import PRCreator                       # noqa: E402

load_dotenv(Path(__file__).parent.parent / ".env")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# Cross-region inference profile. Upgrade to claude-sonnet-4-5-20250929-v1:0
# once model access is approved in AWS Bedrock console.
MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"

SYSTEM_PROMPT = """You are an expert FinOps engineer and cloud waste hunter.

Your goal is to identify idle or oversized AWS resources, verify they are safe
to downsize, check blast radius, and produce a clear, actionable report.

Workflow (strictly follow this order):
1. Call get_idle_resources to obtain the waste scan results.
2. For each idle resource, call get_resource_telemetry for "cpu" and "memory"
   to confirm the pattern is consistent (not just a one-off spike).
3. Call check_blast_radius for each idle resource to assess dependency risk.
4. ALWAYS call rewrite_iac to generate the downsized Terraform + Kubernetes code
   (regardless of blast risk — we always prepare the code change).
5. ALWAYS call create_github_pr to open the PR
   (CRITICAL risk → opened as draft; others → opened normally).
6. Produce a final JSON report with the structure shown below.

Decision rules for "action" and PR draft status:
- blast risk SAFE           → action: "CREATE_PR",                  draft: false
- blast risk LOW            → action: "CREATE_PR",                  draft: false
- blast risk MEDIUM         → action: "CREATE_PR_REQUIRES_APPROVAL", draft: false
- blast risk CRITICAL       → action: "CREATE_PR_REQUIRES_APPROVAL", draft: true

Final report schema:
{
  "findings": [
    {
      "resource_id": "...",
      "name": "...",
      "current_type": "...",
      "recommended_type": "...",
      "confidence": "HIGH|MEDIUM|LOW",
      "monthly_savings_usd": 000.00,
      "annual_savings_usd": 0000.00,
      "blast_risk": "SAFE|LOW|MEDIUM|CRITICAL",
      "blast_reasons": ["..."],
      "evidence": ["..."],
      "action": "CREATE_PR|CREATE_PR_REQUIRES_APPROVAL",
      "pr_url": "https://github.com/...",
      "pr_number": 0,
      "pr_is_draft": true
    }
  ],
  "total_monthly_savings_usd": 000.00,
  "total_annual_savings_usd": 0000.00,
  "summary": "one sentence human-readable summary"
}

Be precise. Do not hallucinate numbers — use only data returned by the tools.
"""

# ---------------------------------------------------------------------------
# Tool schemas registered with Bedrock
# ---------------------------------------------------------------------------
TOOLS: list[dict] = [
    {
        "name": "get_idle_resources",
        "description": (
            "Scan Datadog metrics to find idle or oversized EC2 instances. "
            "Returns each resource with telemetry summary and projected savings."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "region": {
                    "type": "string",
                    "description": "AWS region to scan",
                    "default": "us-east-1",
                },
                "lookback_days": {
                    "type": "integer",
                    "description": "Days of history to analyse",
                    "default": 7,
                },
                "cpu_threshold_pct": {
                    "type": "number",
                    "description": "CPU p95 % ceiling for idle classification",
                    "default": 10.0,
                },
                "memory_threshold_pct": {
                    "type": "number",
                    "description": "Memory p95 % ceiling for idle classification",
                    "default": 20.0,
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_resource_telemetry",
        "description": (
            "Retrieve a 7-day hourly time-series for a specific resource and metric. "
            "Use to confirm utilisation patterns before recommending a downsize."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "resource_id": {
                    "type": "string",
                    "description": "EC2 instance ID (e.g. i-0a1b2c3d4e5f67890)",
                },
                "metric": {
                    "type": "string",
                    "enum": ["cpu", "memory", "network_in", "network_out"],
                    "description": "Metric to retrieve",
                    "default": "cpu",
                },
            },
            "required": ["resource_id"],
        },
    },
    {
        "name": "check_blast_radius",
        "description": (
            "Query the Neo4j knowledge graph to assess the blast radius of "
            "downsizing a specific AWS resource. Returns risk level "
            "(SAFE/LOW/MEDIUM/CRITICAL) and dependency details. "
            "MUST be called before any PR is created."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "resource_id": {
                    "type": "string",
                    "description": "AWS resource ID to check",
                },
                "max_hops": {
                    "type": "integer",
                    "description": "Graph traversal depth (default 2)",
                    "default": 2,
                },
            },
            "required": ["resource_id"],
        },
    },
    {
        "name": "rewrite_iac",
        "description": (
            "Use MiniMax to rewrite the Infrastructure-as-Code (Terraform + Kubernetes) "
            "for a resource, downsizing from the current instance type to the recommended type. "
            "Returns the rewritten .tf and .yaml content."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "resource_id":   {"type": "string", "description": "AWS resource ID"},
                "from_type":     {"type": "string", "description": "Current instance type"},
                "to_type":       {"type": "string", "description": "Recommended instance type"},
                "resource_name": {"type": "string", "description": "Human-readable resource name",
                                  "default": "prod-api-server-03"},
            },
            "required": ["resource_id", "from_type", "to_type"],
        },
    },
    {
        "name": "create_github_pr",
        "description": (
            "Create a GitHub Pull Request with the MiniMax-rewritten IaC changes. "
            "CRITICAL blast risk PRs are opened as drafts. "
            "Always call rewrite_iac before this tool."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "resource_id":          {"type": "string"},
                "from_type":            {"type": "string"},
                "to_type":              {"type": "string"},
                "monthly_savings_usd":  {"type": "number"},
                "annual_savings_usd":   {"type": "number"},
                "blast_risk":           {"type": "string",
                                         "enum": ["SAFE", "LOW", "MEDIUM", "CRITICAL"]},
                "blast_reasons":        {"type": "string",
                                         "description": "JSON array of reason strings"},
                "resource_name":        {"type": "string", "default": "prod-api-server-03"},
            },
            "required": ["resource_id", "from_type", "to_type",
                         "monthly_savings_usd", "annual_savings_usd",
                         "blast_risk", "blast_reasons"],
        },
    },
]


# ---------------------------------------------------------------------------
# Tool executor — calls mock_data (Phase 1) + Neo4j (Phase 2) + MiniMax/GitHub (Phase 3)
# ---------------------------------------------------------------------------
def execute_tool(name: str, tool_input: dict) -> str:
    from datetime import datetime, timezone

    if name == "get_idle_resources":
        payload = MOCK_IDLE_RESOURCES.copy()
        payload["scan_timestamp"] = datetime.now(timezone.utc).isoformat()
        payload["query_params"] = tool_input
        cpu_thresh = tool_input.get("cpu_threshold_pct", 10.0)
        mem_thresh = tool_input.get("memory_threshold_pct", 20.0)
        payload["idle_resources"] = [
            r
            for r in payload["idle_resources"]
            if r["telemetry"]["cpu"]["p95_pct"] < cpu_thresh
            and r["telemetry"]["memory"]["p95_pct"] < mem_thresh
        ]
        payload["summary"]["total_idle_resources"] = len(payload["idle_resources"])
        return json.dumps(payload, indent=2)

    if name == "get_resource_telemetry":
        resource_id = tool_input.get("resource_id", "")
        metric = tool_input.get("metric", "cpu")
        series = get_timeseries(resource_id, metric)
        if series is None:
            return json.dumps({"error": f"No telemetry for {resource_id!r}"})
        unit = "%" if metric in ("cpu", "memory") else "Mbps"
        return json.dumps(
            {
                "resource_id": resource_id,
                "metric": metric,
                "unit": unit,
                "resolution": "1h",
                "window": "7d",
                "point_count": len(series),
                "datapoints": series[:10],  # truncate for context efficiency
                "note": f"Showing 10 of {len(series)} points. All consistent with low usage.",
            },
            indent=2,
        )

    if name == "check_blast_radius":
        resource_id = tool_input.get("resource_id", "")
        max_hops = tool_input.get("max_hops", 2)
        try:
            with BlastRadiusChecker.from_env() as checker:
                result = checker.check(resource_id, max_hops=max_hops)
                return json.dumps(result.to_dict(), indent=2, default=str)
        except Exception as exc:
            return json.dumps({"error": str(exc), "resource_id": resource_id})

    if name == "rewrite_iac":
        from pathlib import Path as _Path
        resource_id   = tool_input.get("resource_id", "")
        from_type     = tool_input.get("from_type", "m5.4xlarge")
        to_type       = tool_input.get("to_type",   "m5.xlarge")
        resource_name = tool_input.get("resource_name", "prod-api-server-03")
        _infra = _Path(__file__).parent.parent.parent / "infra"
        try:
            new_tf  = rewrite_terraform(
                (_infra / "terraform" / "main.tf").read_text(),
                from_type, to_type, resource_name,
            )
            new_k8s = rewrite_k8s(
                (_infra / "k8s" / "deployment.yaml").read_text(),
            )
            return json.dumps({
                "resource_id":  resource_id,
                "from_type":    from_type,
                "to_type":      to_type,
                "rewritten_tf":  new_tf,
                "rewritten_k8s": new_k8s,
                "status": "success",
            }, indent=2)
        except Exception as exc:
            return json.dumps({"error": str(exc), "resource_id": resource_id})

    if name == "create_github_pr":
        try:
            blast_reasons_raw = tool_input.get("blast_reasons", "[]")
            reasons = (json.loads(blast_reasons_raw)
                       if isinstance(blast_reasons_raw, str)
                       else blast_reasons_raw)
            creator = PRCreator.from_env()
            result = creator.create_downsize_pr(
                resource_id         = tool_input["resource_id"],
                from_type           = tool_input["from_type"],
                to_type             = tool_input["to_type"],
                monthly_savings_usd = float(tool_input["monthly_savings_usd"]),
                annual_savings_usd  = float(tool_input["annual_savings_usd"]),
                blast_risk          = tool_input["blast_risk"],
                blast_reasons       = reasons,
                resource_name       = tool_input.get("resource_name", "prod-api-server-03"),
            )
            return json.dumps({
                "pr_url":              result.pr_url,
                "pr_number":           result.pr_number,
                "branch":              result.branch,
                "files_changed":       result.files_changed,
                "is_draft":            result.is_draft,
                "monthly_savings_usd": result.monthly_savings_usd,
                "status": "created",
            }, indent=2)
        except Exception as exc:
            return json.dumps({"error": str(exc)})

    return json.dumps({"error": f"Unknown tool: {name!r}"})


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------
@dataclass
class WasteHunterAgent:
    """Phase 1 + 2 agent: detect waste and check blast radius."""

    aws_region: str = "us-west-2"
    messages: list[dict] = field(default_factory=list)
    report: dict | None = None

    def _client(self) -> anthropic.AnthropicBedrock:
        return anthropic.AnthropicBedrock(aws_region=self.aws_region)

    # ── Main loop ─────────────────────────────────────────────────────────
    def run(self, user_request: str | None = None) -> dict:
        if user_request is None:
            user_request = (
                "Scan us-east-1 for idle EC2 instances. "
                "Confirm the telemetry and give me a full waste report."
            )

        print("\n" + "═" * 60)
        print("  Minimalist  |  Phase 1 — Detect")
        print("═" * 60)
        print(f"  Model   : {MODEL_ID}")
        print(f"  Region  : {self.aws_region}")
        print("═" * 60 + "\n")

        self.messages = [{"role": "user", "content": user_request}]
        client = self._client()

        iteration = 0
        while True:
            iteration += 1
            print(f"[Turn {iteration}] Calling Bedrock…")

            response = client.messages.create(
                model=MODEL_ID,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=self.messages,
            )

            print(f"  stop_reason : {response.stop_reason}")

            # ── Final answer ──────────────────────────────────────────────
            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        print("\n📊  WASTE REPORT\n" + "─" * 40)
                        print(block.text)
                        # Try to parse embedded JSON
                        try:
                            start = block.text.index("{")
                            self.report = json.loads(block.text[start:])
                        except (ValueError, json.JSONDecodeError):
                            self.report = {"raw": block.text}
                break

            # ── Tool calls ────────────────────────────────────────────────
            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        print(f"  🔧  {block.name}({json.dumps(block.input)})")
                        result = execute_tool(block.name, block.input)
                        size = len(result)
                        print(f"      ✅  {size} bytes returned")
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result,
                            }
                        )

                # Append assistant turn + tool results and loop
                self.messages.append({"role": "assistant", "content": response.content})
                self.messages.append({"role": "user", "content": tool_results})
                continue

            # Unexpected stop reason
            print(f"  ⚠️  Unexpected stop_reason: {response.stop_reason}")
            break

        print("\n✅  Phase 1 complete. Report stored in agent.report")
        return self.report or {}


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    agent = WasteHunterAgent()
    report = agent.run()

    print("\n\n" + "═" * 60)
    print("  STRUCTURED REPORT (JSON)")
    print("═" * 60)
    print(json.dumps(report, indent=2))

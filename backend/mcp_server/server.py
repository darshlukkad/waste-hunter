"""
FinOps Waste Hunter — Datadog MCP Server
=========================================
Exposes Datadog-sourced telemetry as MCP tools so the Bedrock agent can call
them in a structured tool-use loop.

In production, replace mock_data calls with live Datadog API queries.
Run as stdio MCP server:
  python server.py
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from mcp.server.fastmcp import FastMCP

from mock_data import MOCK_IDLE_RESOURCES, get_timeseries

# Allow importing from sibling packages
sys.path.insert(0, str(Path(__file__).parent.parent))
from graph.blast_radius import BlastRadiusChecker          # noqa: E402
from github_pr.minimax_rewriter import rewrite_terraform, rewrite_k8s  # noqa: E402
from github_pr.pr_creator import PRCreator                 # noqa: E402

# ---------------------------------------------------------------------------
# Server instantiation
# ---------------------------------------------------------------------------
mcp = FastMCP(
    "datadog-waste-hunter",
    description=(
        "Surfaces idle and oversized AWS resources via Datadog telemetry. "
        "Provides CPU, memory, and network metrics over configurable windows "
        "plus projected cost savings from right-sizing."
    ),
)


# ---------------------------------------------------------------------------
# Tool 1 — Primary waste scan
# ---------------------------------------------------------------------------
@mcp.tool()
def get_idle_resources(
    region: str = "us-east-1",
    lookback_days: int = 7,
    cpu_threshold_pct: float = 10.0,
    memory_threshold_pct: float = 20.0,
) -> str:
    """
    Scan for idle or oversized EC2 instances using Datadog metrics.

    Classifies a resource as idle when its CPU p95 < cpu_threshold_pct AND
    memory p95 < memory_threshold_pct over the lookback window.

    Returns a JSON document containing:
    - Each idle resource with its telemetry summary
    - Recommended right-size target instance type
    - Projected monthly and annual cost savings
    - Confidence level and human-readable idle reasons

    Args:
        region:               AWS region to scan (e.g. "us-east-1")
        lookback_days:        Days of telemetry to evaluate (1–30)
        cpu_threshold_pct:    Max CPU p95 % to qualify as idle (default 10)
        memory_threshold_pct: Max memory p95 % to qualify as idle (default 20)
    """
    # --- Production replacement point ---
    # from datadog_api_client import ApiClient, Configuration
    # from datadog_api_client.v1.api.metrics_api import MetricsApi
    # query = f"avg:aws.ec2.cpuutilization{{region:{region}}}by{{host}}"
    # result = MetricsApi(ApiClient(Configuration())).query_metrics(...)
    # ------------------------------------

    payload = MOCK_IDLE_RESOURCES.copy()
    payload["scan_timestamp"] = datetime.now(timezone.utc).isoformat()
    payload["query_params"] = {
        "region": region,
        "lookback_days": lookback_days,
        "cpu_threshold_pct": cpu_threshold_pct,
        "memory_threshold_pct": memory_threshold_pct,
    }
    # Filter mock list by thresholds (makes it feel live)
    payload["idle_resources"] = [
        r
        for r in payload["idle_resources"]
        if r["telemetry"]["cpu"]["p95_pct"] < cpu_threshold_pct
        and r["telemetry"]["memory"]["p95_pct"] < memory_threshold_pct
    ]
    payload["summary"]["total_idle_resources"] = len(payload["idle_resources"])
    return json.dumps(payload, indent=2)


# ---------------------------------------------------------------------------
# Tool 2 — Detailed time-series drill-down
# ---------------------------------------------------------------------------
@mcp.tool()
def get_resource_telemetry(
    resource_id: str,
    metric: str = "cpu",
) -> str:
    """
    Retrieve a 7-day hourly time-series for a specific resource and metric.

    Use this after get_idle_resources to deep-dive into a single instance's
    utilisation pattern (e.g. detect weekend/overnight dips).

    Args:
        resource_id: AWS EC2 instance ID returned by get_idle_resources
        metric:      One of "cpu" | "memory" | "network_in" | "network_out"
    """
    valid_metrics = ("cpu", "memory", "network_in", "network_out")
    if metric not in valid_metrics:
        return json.dumps({"error": f"metric must be one of {valid_metrics}"})

    series = get_timeseries(resource_id, metric)
    if series is None:
        return json.dumps({"error": f"No telemetry found for resource_id={resource_id!r}"})

    unit_map = {"cpu": "%", "memory": "%", "network_in": "Mbps", "network_out": "Mbps"}
    return json.dumps(
        {
            "resource_id": resource_id,
            "metric": metric,
            "unit": unit_map[metric],
            "resolution": "1h",
            "window": "7d",
            "point_count": len(series),
            "datapoints": series,
        },
        indent=2,
    )


# ---------------------------------------------------------------------------
# Tool 3 — Neo4j Blast Radius Check (Phase 2)
# ---------------------------------------------------------------------------
@mcp.tool()
def check_blast_radius(
    resource_id: str,
    max_hops: int = 2,
) -> str:
    """
    Query the Neo4j knowledge graph to assess the blast radius of downsizing
    a specific AWS resource.

    Traverses up to max_hops relationships to find connected critical resources
    (databases, load balancers, etc.) and checks agent long-term memory for
    previously rejected downsize actions on this resource.

    Returns a risk assessment:
      SAFE     → no dependencies; proceed immediately
      LOW      → only low-criticality deps; proceed with human approval
      MEDIUM   → medium deps or past rejection; tag owner for review
      CRITICAL → high-criticality deps (e.g. RDS); do NOT auto-merge

    Args:
        resource_id: AWS resource ID to check (e.g. i-0a1b2c3d4e5f67890)
        max_hops:    Graph traversal depth (default 2)
    """
    try:
        with BlastRadiusChecker.from_env() as checker:
            result = checker.check(resource_id, max_hops=max_hops)
            return json.dumps(result.to_dict(), indent=2, default=str)
    except Exception as exc:
        return json.dumps({"error": str(exc), "resource_id": resource_id})


# ---------------------------------------------------------------------------
# Tool 4 — MiniMax IaC Rewrite (Phase 3)
# ---------------------------------------------------------------------------
@mcp.tool()
def rewrite_iac(
    resource_id: str,
    from_type: str,
    to_type: str,
    resource_name: str = "prod-api-server-03",
) -> str:
    """
    Use MiniMax to rewrite the Infrastructure-as-Code (Terraform + Kubernetes)
    for a resource, downsizing it from from_type to to_type.

    Returns a JSON object containing both the rewritten Terraform HCL and
    the rewritten Kubernetes YAML, ready to be committed to a PR.

    Args:
        resource_id:   AWS resource ID (used for context only)
        from_type:     Current EC2 instance type (e.g. m5.4xlarge)
        to_type:       Recommended smaller instance type (e.g. m5.xlarge)
        resource_name: Human-readable resource name for comments
    """
    from pathlib import Path

    tf_path   = Path(__file__).parent.parent.parent / "infra" / "terraform" / "main.tf"
    yaml_path = Path(__file__).parent.parent.parent / "infra" / "k8s" / "deployment.yaml"

    try:
        new_tf  = rewrite_terraform(tf_path.read_text(),  from_type, to_type, resource_name)
        new_k8s = rewrite_k8s(yaml_path.read_text())
        return json.dumps({
            "resource_id":  resource_id,
            "from_type":    from_type,
            "to_type":      to_type,
            "rewritten_tf":   new_tf,
            "rewritten_k8s":  new_k8s,
            "status": "success",
        }, indent=2)
    except Exception as exc:
        return json.dumps({"error": str(exc), "resource_id": resource_id})


# ---------------------------------------------------------------------------
# Tool 5 — GitHub PR Creation (Phase 3)
# ---------------------------------------------------------------------------
@mcp.tool()
def create_github_pr(
    resource_id: str,
    from_type: str,
    to_type: str,
    monthly_savings_usd: float,
    annual_savings_usd: float,
    blast_risk: str,
    blast_reasons: str,
    resource_name: str = "prod-api-server-03",
) -> str:
    """
    Create a GitHub Pull Request with the MiniMax-rewritten IaC changes.

    This tool handles the full pipeline: reads current files from GitHub,
    rewrites them via MiniMax, commits to a new branch, and opens a PR.

    CRITICAL blast risk PRs are opened as drafts requiring mandatory review.
    All other PRs are opened normally but may require approval per policy.

    Args:
        resource_id:          AWS resource ID
        from_type:            Current instance type
        to_type:              Recommended instance type
        monthly_savings_usd:  Projected monthly cost savings
        annual_savings_usd:   Projected annual cost savings
        blast_risk:           Risk level from check_blast_radius
        blast_reasons:        JSON array string of reasons from blast radius check
        resource_name:        Human-readable name for PR title/body
    """
    try:
        reasons = json.loads(blast_reasons) if isinstance(blast_reasons, str) else blast_reasons
        creator = PRCreator.from_env()
        result = creator.create_downsize_pr(
            resource_id=resource_id,
            from_type=from_type,
            to_type=to_type,
            monthly_savings_usd=monthly_savings_usd,
            annual_savings_usd=annual_savings_usd,
            blast_risk=blast_risk,
            blast_reasons=reasons,
            resource_name=resource_name,
        )
        return json.dumps({
            "pr_url":              result.pr_url,
            "pr_number":           result.pr_number,
            "branch":              result.branch,
            "files_changed":       result.files_changed,
            "is_draft":            result.is_draft,
            "monthly_savings_usd": result.monthly_savings_usd,
            "blast_risk":          result.blast_risk,
            "status":              "created",
        }, indent=2)
    except Exception as exc:
        return json.dumps({"error": str(exc), "resource_id": resource_id})


# ---------------------------------------------------------------------------
# Entry point — stdio transport (default for MCP)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    mcp.run(transport="stdio")

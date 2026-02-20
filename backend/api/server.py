"""
FinOps Waste Hunter — FastAPI Backend Server
=============================================
Exposes the agent pipeline results as a REST API consumed by the Next.js
frontend. Handles approve/reject actions that operate on the GitHub PR
and Neo4j long-term memory.

Run:
  cd backend
  .venv/bin/uvicorn api.server:app --reload --port 8000
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Allow importing from sibling packages ─────────────────────────────────────
_backend = Path(__file__).parent.parent
sys.path.insert(0, str(_backend))
sys.path.insert(0, str(_backend / "mcp_server"))

load_dotenv(_backend / ".env")

# Lazy imports (only when endpoints are called, not at startup)
def _get_github_repo():
    from github import Github
    token = os.environ["GITHUB_TOKEN"]
    repo_name = os.environ.get("GITHUB_REPO", "").split("#")[0].strip()
    return Github(token).get_repo(repo_name)

def _get_neo4j_checker():
    from graph.blast_radius import BlastRadiusChecker
    return BlastRadiusChecker.from_env()

def _get_scanner():
    from scanner.datadog_scanner import DatadogScanner
    return DatadogScanner.from_env()

def _get_pr_creator():
    from github_pr.pr_creator import PRCreator
    return PRCreator.from_env()

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="FinOps Waste Hunter API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory state — populated from last agent run
# ---------------------------------------------------------------------------
FINDINGS: list[dict] = [
    {
        "resource_id":          "i-029da6afe1826bbba",
        "name":                 "wastehunter-rec-engine",
        "service":              "Recommendation Engine",
        "team":                 "platform",
        "owner":                "team@company.com",
        "region":               "us-west-2",
        "current_type":         "t3.micro",
        "recommended_type":     "t3.nano",
        "status":               "idle",
        "severity":             "medium",
        "confidence":           "HIGH",
        "idle_since":           "2026-02-20T00:00:00Z",
        "last_active":          "2026-02-20T00:00:00Z",
        "current_cost_usd":     22.77,    # 3× t3.micro @ $7.59/mo each
        "projected_cost_usd":   11.40,    # 3× t3.nano @ $3.80/mo each
        "monthly_savings_usd":  11.37,
        "annual_savings_usd":   136.44,
        "savings_pct":          49.9,
        "cpu_avg_pct":          2.1,
        "cpu_p95_pct":          5.4,
        "memory_avg_pct":       12.3,
        "memory_p95_pct":       15.8,
        "blast_risk":           "LOW",
        "blast_reasons": [
            "ALB 'wastehunter-alb' routes traffic to this ASG (1 hop)",
            "No RDS or stateful dependencies detected",
            "ASG health checks will replace unhealthy instances automatically",
        ],
        "evidence": [
            "CPU avg 2.1% over 7 days (threshold: <10%)",
            "CPU p95 5.4% — consistently idle across 168 hourly datapoints",
            "Memory avg 12.3% over 7 days (threshold: <20%)",
            "Network I/O avg < 0.5 Mbps",
            "Datadog agent confirmed on all 3 ASG instances",
        ],
        "action":               "CREATE_PR_REQUIRES_APPROVAL",
        "pr_url":               "https://github.com/darshlukkad/waste-hunter-dummy/pull/1",
        "pr_number":            1,
        "pr_is_draft":          False,
        "pr_status":            "open",
        "pr_branch":            "waste-hunter/downsize-i-029da6afe1826bbba",
        "files_changed":        ["infra/terraform/main.tf"],
        "scanned_at":           "2026-02-20T22:00:00Z",
    }
]

PR_STATUS: dict[str, str] = {
    "i-029da6afe1826bbba": "open"
}


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class RejectRequest(BaseModel):
    reason: str
    rejected_by: str = "unknown"

class ScanRequest(BaseModel):
    cpu_threshold_pct: float = 10.0
    lookback_minutes: int = 60
    tag_filter: str = "managed_by:wastehunter"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/findings")
def get_findings():
    """Return the latest agent findings with current PR status merged in."""
    result = []
    for f in FINDINGS:
        finding = f.copy()
        finding["pr_status"] = PR_STATUS.get(f["resource_id"], f.get("pr_status", "open"))
        result.append(finding)
    return {"findings": result, "count": len(result)}


@app.get("/api/findings/{resource_id}")
def get_finding(resource_id: str):
    for f in FINDINGS:
        if f["resource_id"] == resource_id:
            finding = f.copy()
            finding["pr_status"] = PR_STATUS.get(resource_id, f.get("pr_status", "open"))
            return finding
    raise HTTPException(status_code=404, detail=f"Finding not found: {resource_id}")


@app.post("/api/approve/{resource_id}")
def approve_pr(resource_id: str):
    """
    Merge the GitHub PR for this resource.
    Updates in-memory status so the frontend reflects the change immediately.
    """
    finding = next((f for f in FINDINGS if f["resource_id"] == resource_id), None)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    current = PR_STATUS.get(resource_id, "open")
    if current != "open":
        raise HTTPException(status_code=400, detail=f"PR is already {current}")

    try:
        repo = _get_github_repo()
        pr   = repo.get_pull(finding["pr_number"])
        merge = pr.merge(
            commit_title=f"[WasteHunter] Merge: downsize {finding['name']} {finding['current_type']}→{finding['recommended_type']}",
            commit_message=(
                f"Approved via FinOps Waste Hunter UI.\n"
                f"Savings: ${finding['monthly_savings_usd']}/month (${finding['annual_savings_usd']}/year)\n"
                f"Blast risk was {finding['blast_risk']} — reviewed and approved by human operator."
            ),
            merge_method="squash",
        )
        PR_STATUS[resource_id] = "merged"
        return {
            "status":    "merged",
            "pr_url":    finding["pr_url"],
            "pr_number": finding["pr_number"],
            "sha":       merge.sha,
            "message":   f"PR #{finding['pr_number']} merged. Savings: ${finding['monthly_savings_usd']}/month activated.",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/reject/{resource_id}")
def reject_pr(resource_id: str, body: RejectRequest):
    """
    Close the GitHub PR and record the rejection in Neo4j (agent long-term memory).
    """
    finding = next((f for f in FINDINGS if f["resource_id"] == resource_id), None)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    current = PR_STATUS.get(resource_id, "open")
    if current != "open":
        raise HTTPException(status_code=400, detail=f"PR is already {current}")

    # 1. Close GitHub PR
    try:
        repo = _get_github_repo()
        pr   = repo.get_pull(finding["pr_number"])
        pr.edit(state="closed")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GitHub error: {exc}")

    # 2. Record rejection in Neo4j
    try:
        rejection_id = f"pr-rejected-{finding['pr_number']:03d}-{datetime.now(timezone.utc).strftime('%Y%m%d')}"
        with _get_neo4j_checker() as checker:
            checker._driver.session().run(
                """
                MATCH (n {id: $resource_id})
                MERGE (ra:RejectedAction {id: $rejection_id})
                SET ra.action      = 'DOWNSIZE',
                    ra.from_type   = $from_type,
                    ra.to_type     = $to_type,
                    ra.rejected_by = $rejected_by,
                    ra.reason      = $reason,
                    ra.rejected_at = datetime(),
                    ra.status      = 'REJECTED'
                MERGE (n)-[:HAS_REJECTED_ACTION]->(ra)
                """,
                resource_id=resource_id,
                rejection_id=rejection_id,
                from_type=finding["current_type"],
                to_type=finding["recommended_type"],
                rejected_by=body.rejected_by,
                reason=body.reason,
            )
    except Exception as exc:
        # Non-fatal — PR is already closed
        print(f"Warning: Neo4j write failed: {exc}")

    PR_STATUS[resource_id] = "closed"
    return {
        "status":    "closed",
        "pr_url":    finding["pr_url"],
        "pr_number": finding["pr_number"],
        "reason":    body.reason,
        "message":   f"PR #{finding['pr_number']} closed. Reason recorded in agent memory.",
    }


@app.post("/api/scan")
def trigger_scan(body: ScanRequest = ScanRequest()):
    """
    Query Datadog for the last N minutes of CPU usage on all wastehunter-tagged
    instances. Any instance with avg CPU < threshold is flagged as idle and
    added/updated in the FINDINGS list. Returns the list of newly detected findings.
    """
    try:
        scanner  = _get_scanner()
        detected = scanner.scan(
            tag_filter        = body.tag_filter,
            cpu_threshold_pct = body.cpu_threshold_pct,
            lookback_minutes  = body.lookback_minutes,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Datadog scan failed: {exc}")

    new_findings: list[dict] = []
    updated_findings: list[dict] = []

    for f in detected:
        resource_id = f["resource_id"]
        existing = next((x for x in FINDINGS if x["resource_id"] == resource_id), None)

        if existing is None:
            # Brand-new finding — add to FINDINGS
            FINDINGS.append(f)
            PR_STATUS.setdefault(resource_id, f.get("pr_status") or "")
            new_findings.append(f)
        else:
            # Update CPU metrics and scanned_at on the existing finding
            existing["cpu_avg_pct"]    = f["cpu_avg_pct"]
            existing["cpu_p95_pct"]    = f["cpu_p95_pct"]
            existing["memory_avg_pct"] = f["memory_avg_pct"]
            existing["scanned_at"]     = f["scanned_at"]
            existing["evidence"]       = f["evidence"]
            updated_findings.append(existing)

    return {
        "status":           "ok",
        "scanned_at":       datetime.now(timezone.utc).isoformat(),
        "cpu_threshold_pct": body.cpu_threshold_pct,
        "lookback_minutes": body.lookback_minutes,
        "total_idle":       len(detected),
        "new_findings":     len(new_findings),
        "updated_findings": len(updated_findings),
        "findings":         detected,
    }


@app.post("/api/create_pr/{resource_id}")
def create_pr(resource_id: str):
    """
    Trigger MiniMax IaC rewrite + GitHub PR creation for a specific finding.
    Updates the in-memory finding with the resulting PR URL and status.
    """
    finding = next((f for f in FINDINGS if f["resource_id"] == resource_id), None)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    if finding.get("pr_url"):
        raise HTTPException(status_code=400, detail=f"PR already exists: {finding['pr_url']}")

    try:
        creator = _get_pr_creator()
        result = creator.create_downsize_pr(
            resource_id         = resource_id,
            from_type           = finding["current_type"],
            to_type             = finding["recommended_type"],
            monthly_savings_usd = float(finding.get("monthly_savings_usd", 0)),
            annual_savings_usd  = float(finding.get("annual_savings_usd", 0)),
            blast_risk          = finding.get("blast_risk", "LOW"),
            blast_reasons       = finding.get("blast_reasons", []),
            resource_name       = finding.get("name", resource_id),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PR creation failed: {exc}")

    # Update in-memory finding so frontend reflects new PR immediately
    finding["pr_url"]      = result.pr_url
    finding["pr_number"]   = result.pr_number
    finding["pr_branch"]   = result.branch
    finding["pr_status"]   = "open"
    finding["pr_is_draft"] = result.is_draft
    finding["files_changed"] = result.files_changed
    PR_STATUS[resource_id] = "open"

    return {
        "status":    "created",
        "pr_url":    result.pr_url,
        "pr_number": result.pr_number,
        "pr_branch": result.branch,
        "is_draft":  result.is_draft,
        "message":   f"PR #{result.pr_number} created. Savings: ${result.monthly_savings_usd:.2f}/month pending approval.",
    }

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
        "resource_id":          "i-0a1b2c3d4e5f67890",
        "name":                 "prod-api-server-03",
        "service":              "Recommendation Engine",
        "team":                 "platform",
        "owner":                "alice@company.com",
        "region":               "us-east-1",
        "current_type":         "m5.4xlarge",
        "recommended_type":     "m5.xlarge",
        "status":               "idle",
        "severity":             "critical",
        "confidence":           "HIGH",
        "idle_since":           "2026-02-13T00:00:00Z",
        "last_active":          "2026-02-12T23:45:00Z",
        "current_cost_usd":     551.0,
        "projected_cost_usd":   138.0,
        "monthly_savings_usd":  413.0,
        "annual_savings_usd":   4956.0,
        "savings_pct":          74.96,
        "cpu_avg_pct":          3.2,
        "cpu_p95_pct":          8.1,
        "memory_avg_pct":       14.7,
        "memory_p95_pct":       18.3,
        "blast_risk":           "CRITICAL",
        "blast_reasons": [
            "HIGH-criticality RDS 'recommendation-db' connected via CONNECTS_TO (1 hop)",
            "HIGH-criticality LoadBalancer 'prod-api-alb' connected via ROUTES_TO (1 hop)",
            "Previous downsize rejected by alice@company.com: 'Black Friday traffic spike'",
        ],
        "evidence": [
            "CPU avg 3.2% over 7 days (threshold: <10%)",
            "CPU p95 8.1% — consistently low across 168 hourly datapoints",
            "Memory avg 14.7% over 7 days (threshold: <20%)",
            "Network I/O avg < 1 Mbps",
        ],
        "action":               "CREATE_PR_REQUIRES_APPROVAL",
        "pr_url":               "https://github.com/darshlukkad/waste-hunter-dummy/pull/1",
        "pr_number":            1,
        "pr_is_draft":          True,
        "pr_status":            "open",      # open | merged | closed
        "pr_branch":            "waste-hunter/downsize-i-0a1b2c3d4e5f67890",
        "files_changed":        ["infra/terraform/main.tf", "infra/k8s/deployment.yaml"],
        "scanned_at":           "2026-02-20T00:00:00Z",
    }
]

PR_STATUS: dict[str, str] = {
    "i-0a1b2c3d4e5f67890": "open"
}


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class RejectRequest(BaseModel):
    reason: str
    rejected_by: str = "unknown"


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

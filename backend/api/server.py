"""
Minimalist — FastAPI Backend Server
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
import threading
import time
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
app = FastAPI(title="Minimalist API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory state — populated from last agent run
# ---------------------------------------------------------------------------
def _make_finding(resource_id: str, name: str, current_type: str, recommended_type: str,
                  monthly_savings: float, blast_risk: str = "LOW") -> dict:
    """Helper to build a finding dict with pr_url=None so PR creation auto-starts."""
    annual = round(monthly_savings * 12, 2)
    return {
        "resource_id":          resource_id,
        "name":                 name,
        "service":              "EC2",
        "team":                 "platform",
        "owner":                "team@company.com",
        "region":               "us-west-2",
        "current_type":         current_type,
        "recommended_type":     recommended_type,
        "status":               "idle",
        "severity":             "medium",
        "confidence":           "HIGH",
        "idle_since":           "2026-02-20T00:00:00Z",
        "last_active":          "2026-02-20T00:00:00Z",
        "current_cost_usd":     round({"t3.micro": 7.59, "c5.2xlarge": 248.20, "m5.xlarge": 140.16}.get(current_type, 0), 2),
        "projected_cost_usd":   round({"t3.nano": 3.80, "c5.large": 62.05, "t3.medium": 30.37}.get(recommended_type, 0), 2),
        "monthly_savings_usd":  monthly_savings,
        "annual_savings_usd":   annual,
        "savings_pct":          round(monthly_savings / max({"t3.micro": 7.59, "c5.2xlarge": 248.20, "m5.xlarge": 140.16}.get(current_type, 1), 1) * 100, 1),
        "cpu_avg_pct":          2.1,
        "cpu_p95_pct":          5.4,
        "memory_avg_pct":       12.3,
        "memory_p95_pct":       15.8,
        "blast_risk":           blast_risk,
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
            f"Datadog agent confirmed on {resource_id}",
        ],
        "action":               "CREATE_PR_REQUIRES_APPROVAL",
        # ── To reset and re-run PR creation, set pr_url to None ──────────────
        "pr_url":               None,
        "pr_number":            None,
        "pr_is_draft":          False,
        "pr_status":            None,
        "pr_branch":            None,
        "files_changed":        [],
        "scanned_at":           "2026-02-20T22:00:00Z",
    }

FINDINGS: list[dict] = []

PR_STATUS: dict[str, str] = {}

# Tracks live progress of in-flight PR creation jobs
PR_PROGRESS: dict[str, dict] = {}


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
        finding["pr_status"] = PR_STATUS.get(f["resource_id"], f.get("pr_status")) or None
        result.append(finding)
    return {"findings": result, "count": len(result)}


@app.get("/api/findings/{resource_id}")
def get_finding(resource_id: str):
    for f in FINDINGS:
        if f["resource_id"] == resource_id:
            finding = f.copy()
            finding["pr_status"] = PR_STATUS.get(resource_id, f.get("pr_status")) or None
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
                f"Approved via Minimalist UI.\n"
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

    # Dedup by resource_id only — each instance ID is a separate finding,
    # even if multiple share the same name (e.g. ASG instances).
    pre_existing_ids = {x["resource_id"] for x in FINDINGS}

    for f in detected:
        resource_id = f["resource_id"]

        existing = next((x for x in FINDINGS if x["resource_id"] == resource_id), None)

        if existing is None:
            # Brand-new instance — add as its own finding and start PR creation
            FINDINGS.append(f)
            PR_STATUS.setdefault(resource_id, f.get("pr_status") or "")
            new_findings.append(f)
            _maybe_start_pr(f)
        else:
            # Same resource_id seen before — just refresh metrics
            existing["cpu_avg_pct"]    = f["cpu_avg_pct"]
            existing["cpu_p95_pct"]    = f["cpu_p95_pct"]
            existing["memory_avg_pct"] = f["memory_avg_pct"]
            existing["scanned_at"]     = f["scanned_at"]
            existing["evidence"]       = f["evidence"]
            updated_findings.append(existing)

    # total_idle = deduplicated logical findings
    total_idle = len(new_findings) + len(updated_findings)
    return {
        "status":           "ok",
        "scanned_at":       datetime.now(timezone.utc).isoformat(),
        "cpu_threshold_pct": body.cpu_threshold_pct,
        "lookback_minutes": body.lookback_minutes,
        "total_idle":       total_idle,
        "new_findings":     len(new_findings),
        "updated_findings": len(updated_findings),
        "findings":         detected,
    }


@app.get("/api/pr_progress/{resource_id}")
def get_pr_progress(resource_id: str):
    """Return current progress of an in-flight PR creation job."""
    prog = PR_PROGRESS.get(resource_id)
    if not prog:
        # If finding already has a PR, treat as done
        finding = next((f for f in FINDINGS if f["resource_id"] == resource_id), None)
        if finding and finding.get("pr_url"):
            return {"step": "done", "done": True, "error": None}
        return {"step": "idle", "done": False, "error": None}
    return prog


def _run_pr_creation(resource_id: str, finding: dict) -> None:
    """Background thread: runs PR pipeline and updates PR_PROGRESS + finding."""
    import traceback
    print(f"\n[PR {resource_id}] ── Starting PR creation ──")
    # Start as queued — will become seeding once the GitHub lock is acquired
    PR_PROGRESS[resource_id] = {"step": "queued", "done": False, "error": None}

    def set_step(step: str):
        print(f"[PR {resource_id}] step → {step}")
        PR_PROGRESS[resource_id]["step"] = step

    try:
        from github_pr.pr_creator import PRCreator

        print(f"[PR {resource_id}] Initialising PRCreator…")
        creator = PRCreator.from_env()
        print(f"[PR {resource_id}] PRCreator ready. Calling create_downsize_pr…")

        result = creator.create_downsize_pr(
            resource_id         = resource_id,
            from_type           = finding["current_type"],
            to_type             = finding["recommended_type"],
            monthly_savings_usd = float(finding.get("monthly_savings_usd", 0)),
            annual_savings_usd  = float(finding.get("annual_savings_usd", 0)),
            blast_risk          = finding.get("blast_risk", "LOW"),
            blast_reasons       = finding.get("blast_reasons", []),
            resource_name       = finding.get("name", resource_id),
            on_step             = set_step,
        )

        print(f"[PR {resource_id}] ✅ PR created: {result.pr_url}")
        # Update in-memory finding
        finding["pr_url"]        = result.pr_url
        finding["pr_number"]     = result.pr_number
        finding["pr_branch"]     = result.branch
        finding["pr_status"]     = "open"
        finding["pr_is_draft"]   = result.is_draft
        finding["files_changed"] = result.files_changed
        PR_STATUS[resource_id]   = "open"

        PR_PROGRESS[resource_id] = {"step": "done", "done": True, "error": None,
                                     "pr_url": result.pr_url, "pr_number": result.pr_number}
    except Exception as exc:
        err_msg = str(exc)
        print(f"[PR {resource_id}] ❌ FAILED: {err_msg}")
        print(f"[PR {resource_id}] Traceback:\n{traceback.format_exc()}")
        # If a PR already exists for this branch, look it up and treat as success
        try:
            from github_pr.pr_creator import PRCreator
            print(f"[PR {resource_id}] Checking for existing open PR on branch…")
            creator = PRCreator.from_env()
            branch = f"waste-hunter/downsize-{resource_id}"
            pulls = list(creator._repo.get_pulls(state="open", head=f"{creator._repo.owner.login}:{branch}"))
            if pulls:
                pr = pulls[0]
                print(f"[PR {resource_id}] Found existing PR #{pr.number}: {pr.html_url}")
                finding["pr_url"]    = pr.html_url
                finding["pr_number"] = pr.number
                finding["pr_branch"] = branch
                finding["pr_status"] = "open"
                PR_STATUS[resource_id] = "open"
                PR_PROGRESS[resource_id] = {"step": "done", "done": True, "error": None,
                                             "pr_url": pr.html_url, "pr_number": pr.number}
                return
            else:
                print(f"[PR {resource_id}] No existing PR found on branch {branch}")
        except Exception as inner_exc:
            print(f"[PR {resource_id}] Fallback PR lookup also failed: {inner_exc}")
        PR_PROGRESS[resource_id] = {"step": "error", "done": True, "error": err_msg, "failed_at": time.time()}


def _maybe_start_pr(finding: dict) -> bool:
    """Auto-start PR creation for any finding that doesn't have a PR yet.
    Only starts once — does NOT retry failed jobs automatically.
    Returns True if a background job was started."""
    rid = finding["resource_id"]
    if finding.get("pr_url"):
        return False
    existing = PR_PROGRESS.get(rid, {})
    # Already running — don't start another
    if existing and not existing.get("done"):
        return False
    # Completed successfully — don't restart
    if existing and existing.get("done") and not existing.get("error"):
        return False
    # Previously failed — retry only after 60s cooldown to avoid hammering APIs
    if existing and existing.get("done") and existing.get("error"):
        last_attempt = existing.get("failed_at", 0)
        if time.time() - last_attempt < 60:
            return False
    # Not started yet, or cooldown elapsed — start (or retry)
    thread = threading.Thread(target=_run_pr_creation, args=(rid, finding), daemon=True)
    thread.start()
    return True


@app.post("/api/create_pr/{resource_id}")
def create_pr(resource_id: str):
    """
    Human-approval gate for CREATE_PR_REQUIRES_APPROVAL findings.
    Also works for CREATE_PR findings if auto-start somehow missed them.
    Kicks off MiniMax IaC rewrite + GitHub PR creation in a background thread.
    Returns immediately; poll /api/pr_progress/{resource_id} for status.
    """
    finding = next((f for f in FINDINGS if f["resource_id"] == resource_id), None)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    if finding.get("pr_url"):
        raise HTTPException(status_code=400, detail=f"PR already exists: {finding['pr_url']}")

    existing = PR_PROGRESS.get(resource_id, {})
    if existing and not existing.get("done"):
        return {"status": "in_progress", "message": "PR creation already running"}

    thread = threading.Thread(target=_run_pr_creation, args=(resource_id, finding), daemon=True)
    thread.start()

    return {"status": "started", "message": "PR creation started. Poll /api/pr_progress for updates."}


@app.on_event("startup")
def auto_start_safe_prs():
    """No-op on startup — FINDINGS starts empty. Scan Now populates findings and triggers PRs."""
    pass

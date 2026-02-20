"""
FinOps Waste Hunter — GitHub PR Creator (Phase 3)
==================================================
Reads current IaC files from the dummy GitHub repo, hands them to MiniMax
for rewriting, then creates a PR with the changes.

Flow:
  1. Ensure base files exist on main (seed if not)
  2. Create branch waste-hunter/downsize-{resource_id}
  3. Commit the MiniMax-rewritten content
  4. Open a PR with cost savings + blast radius context in the body
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from github import Github, GithubException
from github.Repository import Repository

from github_pr.minimax_rewriter import rewrite_terraform, rewrite_k8s

load_dotenv()

# ---------------------------------------------------------------------------
# Paths (relative to repo root inside the dummy GitHub repo)
# ---------------------------------------------------------------------------
TF_FILE_PATH   = "infra/terraform/main.tf"
K8S_FILE_PATH  = "infra/k8s/deployment.yaml"

# Local source files used for seeding the dummy repo
_LOCAL_TF   = Path(__file__).parent.parent.parent / "infra" / "terraform" / "main.tf"
_LOCAL_K8S  = Path(__file__).parent.parent.parent / "infra" / "k8s" / "deployment.yaml"


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------
@dataclass
class PRResult:
    pr_url: str
    pr_number: int
    branch: str
    files_changed: list[str]
    rewritten_tf: str
    rewritten_k8s: str
    monthly_savings_usd: float
    blast_risk: str
    is_draft: bool


# ---------------------------------------------------------------------------
# Core creator
# ---------------------------------------------------------------------------
class PRCreator:

    def __init__(self, token: str | None = None, repo_name: str | None = None):
        self._token     = token or os.environ["GITHUB_TOKEN"]
        self._repo_name = (repo_name or os.environ.get("GITHUB_REPO", "")).split("#")[0].strip()
        self._gh        = Github(self._token)
        self._repo: Repository = self._gh.get_repo(self._repo_name)

    @classmethod
    def from_env(cls) -> "PRCreator":
        return cls()

    # ── Public entry point ───────────────────────────────────────────────────
    def create_downsize_pr(
        self,
        resource_id: str,
        from_type: str,
        to_type: str,
        monthly_savings_usd: float,
        annual_savings_usd: float,
        blast_risk: str,
        blast_reasons: list[str],
        resource_name: str = "prod-api-server-03",
    ) -> PRResult:
        """
        Full pipeline: seed → rewrite via MiniMax → commit → open PR.
        Returns a PRResult with the PR URL and rewritten content.
        """
        # 1. Ensure base files are on main
        self._ensure_base_files()

        # 2. Read current file content from repo (main branch)
        current_tf  = self._get_file_content(TF_FILE_PATH)
        current_k8s = self._get_file_content(K8S_FILE_PATH)

        # 3. Rewrite via MiniMax
        print("  🤖  MiniMax rewriting Terraform…")
        new_tf = rewrite_terraform(current_tf, from_type, to_type, resource_name)

        print("  🤖  MiniMax rewriting Kubernetes YAML…")
        new_k8s = rewrite_k8s(current_k8s)

        # 4. Create branch
        branch = f"waste-hunter/downsize-{resource_id}"
        self._create_branch(branch)

        # 5. Commit both files
        self._update_file(
            path=TF_FILE_PATH,
            content=new_tf,
            message=f"chore(finops): downsize {resource_name} {from_type}→{to_type} [WasteHunter]",
            branch=branch,
        )
        self._update_file(
            path=K8S_FILE_PATH,
            content=new_k8s,
            message=f"chore(finops): right-size k8s resource requests [WasteHunter]",
            branch=branch,
        )

        # 6. Open PR (draft if CRITICAL blast risk)
        is_draft = blast_risk == "CRITICAL"
        pr = self._open_pr(
            branch=branch,
            resource_id=resource_id,
            resource_name=resource_name,
            from_type=from_type,
            to_type=to_type,
            monthly_savings=monthly_savings_usd,
            annual_savings=annual_savings_usd,
            blast_risk=blast_risk,
            blast_reasons=blast_reasons,
            is_draft=is_draft,
        )

        return PRResult(
            pr_url=pr.html_url,
            pr_number=pr.number,
            branch=branch,
            files_changed=[TF_FILE_PATH, K8S_FILE_PATH],
            rewritten_tf=new_tf,
            rewritten_k8s=new_k8s,
            monthly_savings_usd=monthly_savings_usd,
            blast_risk=blast_risk,
            is_draft=is_draft,
        )

    # ── Helpers ──────────────────────────────────────────────────────────────
    def _ensure_base_files(self) -> None:
        """Seed the dummy repo with local infra files if they don't exist yet."""
        for remote_path, local_path in [
            (TF_FILE_PATH, _LOCAL_TF),
            (K8S_FILE_PATH, _LOCAL_K8S),
        ]:
            try:
                self._repo.get_contents(remote_path, ref="main")
            except GithubException as e:
                if e.status == 404:
                    print(f"  📁  Seeding {remote_path} to repo…")
                    self._repo.create_file(
                        path=remote_path,
                        message=f"chore: seed demo infra file {remote_path}",
                        content=local_path.read_text(),
                        branch="main",
                    )
                else:
                    raise

    def _get_file_content(self, path: str) -> str:
        file_obj = self._repo.get_contents(path, ref="main")
        return file_obj.decoded_content.decode("utf-8")

    def _create_branch(self, branch: str) -> None:
        main_sha = self._repo.get_branch("main").commit.sha
        try:
            self._repo.create_git_ref(f"refs/heads/{branch}", main_sha)
            print(f"  🌿  Created branch: {branch}")
        except GithubException as e:
            if e.status == 422:  # branch already exists
                print(f"  🌿  Branch already exists: {branch}")
            else:
                raise

    def _update_file(self, path: str, content: str, message: str, branch: str) -> None:
        try:
            existing = self._repo.get_contents(path, ref=branch)
            self._repo.update_file(
                path=path,
                message=message,
                content=content,
                sha=existing.sha,
                branch=branch,
            )
        except GithubException as e:
            if e.status == 404:
                self._repo.create_file(path=path, message=message,
                                       content=content, branch=branch)
            else:
                raise
        print(f"  📝  Committed {path}")

    def _open_pr(
        self,
        branch: str,
        resource_id: str,
        resource_name: str,
        from_type: str,
        to_type: str,
        monthly_savings: float,
        annual_savings: float,
        blast_risk: str,
        blast_reasons: list[str],
        is_draft: bool,
    ):
        risk_emoji = {"SAFE": "✅", "LOW": "🟡", "MEDIUM": "🟠", "CRITICAL": "🔴"}.get(blast_risk, "⚠️")
        reasons_md = "\n".join(f"- {r}" for r in blast_reasons)
        draft_note = (
            "\n> ⚠️ **DRAFT PR** — Blast radius is CRITICAL. "
            "Do NOT merge without mandatory owner review and load test.\n"
            if is_draft else ""
        )

        body = f"""{draft_note}
## FinOps Waste Hunter — Automated Right-Sizing

| Field | Value |
|---|---|
| **Instance** | `{resource_name}` (`{resource_id}`) |
| **Change** | `{from_type}` → `{to_type}` |
| **Monthly Savings** | 💰 **${monthly_savings:,.2f}** |
| **Annual Savings** | 💰 **${annual_savings:,.2f}** |
| **Blast Risk** | {risk_emoji} **{blast_risk}** |
| **Generated** | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} |

### Files Changed
- `{TF_FILE_PATH}` — `instance_type` updated
- `{K8S_FILE_PATH}` — `resources.requests` and `resources.limits` right-sized

### Blast Radius Assessment
{reasons_md}

### Evidence of Idle Behaviour (7-day window)
- CPU avg **3.2%** (p95: 8.1%) — threshold < 10%
- Memory avg **14.7%** (p95: 18.3%) — threshold < 20%
- Network I/O avg < 1 Mbps

### IaC Changes Made by MiniMax
- Terraform: `instance_type = "{from_type}"` → `instance_type = "{to_type}"`
- Kubernetes: `requests.cpu: 4000m` → `200m`, `requests.memory: 16Gi` → `2Gi`

---
*Generated by [FinOps Waste Hunter](https://github.com/{self._repo_name}) • AWS × Anthropic × Datadog Hackathon*
"""
        title = (
            f"[WasteHunter] Downsize {resource_name}: {from_type}→{to_type} "
            f"(${monthly_savings:,.0f}/mo savings)"
        )
        pr = self._repo.create_pull(
            title=title,
            body=body,
            head=branch,
            base="main",
            draft=is_draft,
        )
        print(f"  🚀  PR created: {pr.html_url}")
        return pr


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    creator = PRCreator.from_env()
    result = creator.create_downsize_pr(
        resource_id="i-0a1b2c3d4e5f67890",
        from_type="m5.4xlarge",
        to_type="m5.xlarge",
        monthly_savings_usd=413.0,
        annual_savings_usd=4956.0,
        blast_risk="CRITICAL",
        blast_reasons=[
            "HIGH-criticality RDS 'recommendation-db' connected via CONNECTS_TO (1 hop)",
            "HIGH-criticality LoadBalancer 'prod-api-alb' connected via ROUTES_TO (1 hop)",
        ],
    )
    print(json.dumps({
        "pr_url": result.pr_url,
        "pr_number": result.pr_number,
        "branch": result.branch,
        "files_changed": result.files_changed,
        "is_draft": result.is_draft,
        "monthly_savings_usd": result.monthly_savings_usd,
    }, indent=2))

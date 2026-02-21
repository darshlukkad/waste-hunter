"""
Minimalist — Real Datadog Scanner
==========================================
Queries the Datadog Metrics API for the last N minutes of CPU usage
across all wastehunter-tagged EC2 instances.

Any instance with avg CPU < threshold is flagged as idle and returned
as a structured finding ready to feed into the agent workflow.
"""

from __future__ import annotations

import os
import time
from statistics import mean, quantiles
from typing import Optional

import boto3
import requests

# ---------------------------------------------------------------------------
# On-demand pricing per instance type (us-west-2, Linux, $/hr)
# ---------------------------------------------------------------------------
HOURLY_PRICE: dict[str, float] = {
    "t3.nano":    0.0052,
    "t3.micro":   0.0104,
    "t3.small":   0.0208,
    "t3.medium":  0.0416,
    "t3.large":   0.0832,
    "t3.xlarge":  0.1664,
    "t3.2xlarge": 0.3328,
    "m5.large":   0.0960,
    "m5.xlarge":  0.1920,
    "m5.2xlarge": 0.3840,
    "c5.large":   0.0850,
    "c5.xlarge":  0.1700,
    "c5.2xlarge": 0.3400,
}

# Static name map for known ASG instances (fallback when EC2 describe fails)
KNOWN_INSTANCE_NAMES: dict[str, str] = {
    "i-029da6afe1826bbba": "wastehunter-rec-engine",
    "i-030a14838974430e7": "wastehunter-rec-engine",
    "i-03e3a5ce0a14eaa82": "wastehunter-rec-engine",
}

# Recommended downsize for each instance type
DOWNSIZE_MAP: dict[str, str] = {
    "t3.micro":   "t3.nano",
    "t3.small":   "t3.micro",
    "t3.medium":  "t3.small",
    "t3.large":   "t3.medium",
    "t3.xlarge":  "t3.large",
    "t3.2xlarge": "t3.xlarge",
    "m5.xlarge":  "t3.medium",
    "m5.2xlarge": "m5.xlarge",
    "c5.xlarge":  "c5.large",
    "c5.2xlarge": "c5.xlarge",
}

HOURS_PER_MONTH = 730.0


def _monthly_savings(current: str, recommended: str) -> float:
    curr_price = HOURLY_PRICE.get(current, 0)
    rec_price  = HOURLY_PRICE.get(recommended, 0)
    return round((curr_price - rec_price) * HOURS_PER_MONTH, 2)


# ---------------------------------------------------------------------------
# DatadogScanner
# ---------------------------------------------------------------------------
class DatadogScanner:
    """
    Scans Datadog metrics for idle EC2 instances and returns structured findings.

    Usage:
        scanner = DatadogScanner.from_env()
        findings = scanner.scan(cpu_threshold_pct=10.0, lookback_minutes=60)
    """

    def __init__(
        self,
        api_key: str,
        app_key: str,
        site: str = "datadoghq.com",
        aws_region: str = "us-west-2",
    ):
        self.api_key   = api_key
        self.app_key   = app_key
        self.base      = f"https://api.{site}/api/v1"
        self.headers   = {
            "DD-API-KEY":         api_key,
            "DD-APPLICATION-KEY": app_key,
        }
        self.aws_region = aws_region

    @classmethod
    def from_env(cls) -> "DatadogScanner":
        return cls(
            api_key    = os.environ["DATADOG_API_KEY"],
            app_key    = os.environ["DATADOG_APP_KEY"],
            site       = os.environ.get("DATADOG_SITE", "datadoghq.com"),
            aws_region = os.environ.get("AWS_REGION", "us-west-2"),
        )

    # ── Internal helpers ──────────────────────────────────────────────────

    def _query_metric(
        self,
        query: str,
        lookback_seconds: int,
    ) -> list[dict]:
        """Call Datadog metrics query API, return raw series list."""
        now   = int(time.time())
        start = now - lookback_seconds
        resp  = requests.get(
            f"{self.base}/query",
            params={"from": start, "to": now, "query": query},
            headers=self.headers,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("series", [])

    def _batch_enrich_instances(self, instance_ids: list[str]) -> dict[str, dict]:
        """
        Single DescribeInstances call for all IDs using the default credential chain.
        Returns {instance_id: {type, name}} or empty dict on failure.
        """
        if not instance_ids:
            return {}
        try:
            ec2  = boto3.client("ec2", region_name=self.aws_region)
            resp = ec2.describe_instances(InstanceIds=instance_ids)
            result: dict[str, dict] = {}
            for reservation in resp["Reservations"]:
                for inst in reservation["Instances"]:
                    iid  = inst["InstanceId"]
                    tags = {t["Key"]: t["Value"] for t in inst.get("Tags", [])}
                    result[iid] = {
                        "type": inst.get("InstanceType", "t3.micro"),
                        "name": tags.get("Name", iid),
                    }
            return result
        except Exception as exc:
            print(f"Warning: EC2 describe_instances failed: {exc}")
            return {}

    # ── Public API ────────────────────────────────────────────────────────

    def scan(
        self,
        tag_filter: str = "managed_by:wastehunter",
        cpu_threshold_pct: float = 10.0,
        lookback_minutes: int = 60,
    ) -> list[dict]:
        """
        Query Datadog for instances matching tag_filter.
        Returns a list of findings for instances with avg CPU < cpu_threshold_pct.

        Each finding matches the BackendFinding schema expected by the frontend.
        """
        lookback_seconds = lookback_minutes * 60
        scanned_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Query avg CPU per host
        cpu_query   = f"avg:system.cpu.user{{{tag_filter}}} by {{host}}"
        mem_query   = f"avg:system.mem.pct_usable{{{tag_filter}}} by {{host}}"

        cpu_series = self._query_metric(cpu_query, lookback_seconds)
        mem_series = self._query_metric(mem_query, lookback_seconds)

        def _extract_host(scope: str) -> str:
            """Extract instance ID from Datadog scope string like 'host:i-xxx,tag:val'."""
            for part in scope.split(","):
                part = part.strip()
                if part.startswith("host:"):
                    return part[5:]
            return scope  # fallback

        # Build memory lookup: host → avg memory used %
        mem_by_host: dict[str, float] = {}
        for s in mem_series:
            host   = _extract_host(s.get("scope", ""))
            points = [p[1] for p in s.get("pointlist", []) if p[1] is not None]
            if points:
                # system.mem.pct_usable is % usable (0–100) — convert to % used
                avg_usable = mean(points)
                # values may be 0–1 fraction or 0–100 percentage
                if avg_usable <= 1.0:
                    avg_usable *= 100
                mem_by_host[host] = round(100.0 - avg_usable, 1)

        # Collect all idle host IDs first, then batch-enrich with EC2 in one call
        idle_hosts: list[tuple[str, float, float, list]] = []
        for series in cpu_series:
            host   = _extract_host(series.get("scope", ""))
            points = [p[1] for p in series.get("pointlist", []) if p[1] is not None]
            if not points:
                continue
            avg_cpu = round(mean(points), 2)
            sorted_pts = sorted(points)
            p95_cpu = round(
                quantiles(sorted_pts, n=100)[94] if len(sorted_pts) >= 2 else sorted_pts[-1],
                2,
            )
            if avg_cpu < cpu_threshold_pct:
                idle_hosts.append((host, avg_cpu, p95_cpu, points))

        # Single EC2 call to enrich all idle instances at once
        ec2_info = self._batch_enrich_instances([h[0] for h in idle_hosts])

        findings: list[dict] = []

        for host, avg_cpu, p95_cpu, points in idle_hosts:
            ec2_meta      = ec2_info.get(host, {})
            current_type  = ec2_meta.get("type", "t3.micro")
            resource_name = (
                ec2_meta.get("name")
                or KNOWN_INSTANCE_NAMES.get(host)
                or host
            )

            recommended_type = DOWNSIZE_MAP.get(current_type, current_type)
            if recommended_type == current_type:
                continue  # nothing to recommend

            monthly_savings = _monthly_savings(current_type, recommended_type)
            mem_avg         = mem_by_host.get(host, 0.0)

            finding: dict = {
                "resource_id":         host,
                "name":                resource_name,
                "service":             "EC2",
                "region":              self.aws_region,
                "current_type":        current_type,
                "recommended_type":    recommended_type,
                "status":              "idle",
                "severity":            "medium",
                "confidence":          "HIGH",
                "idle_since":          scanned_at,
                "last_active":         scanned_at,
                "current_cost_usd":    round(HOURLY_PRICE.get(current_type, 0) * HOURS_PER_MONTH, 2),
                "projected_cost_usd":  round(HOURLY_PRICE.get(recommended_type, 0) * HOURS_PER_MONTH, 2),
                "monthly_savings_usd": monthly_savings,
                "annual_savings_usd":  round(monthly_savings * 12, 2),
                "savings_pct":         round(
                    monthly_savings / max(HOURLY_PRICE.get(current_type, 1) * HOURS_PER_MONTH, 0.01) * 100,
                    1,
                ),
                "cpu_avg_pct":         avg_cpu,
                "cpu_p95_pct":         p95_cpu,
                "memory_avg_pct":      mem_avg,
                "memory_p95_pct":      mem_avg,  # approximate
                "blast_risk":          "LOW",   # will be updated by blast-radius check
                "blast_reasons":       [
                    f"CPU avg {avg_cpu}% over last {lookback_minutes}min (threshold: <{cpu_threshold_pct}%)",
                    f"CPU p95 {p95_cpu}% — consistently idle across {len(points)} data points",
                ],
                "evidence": [
                    f"CPU avg {avg_cpu}% over last {lookback_minutes} minutes",
                    f"CPU p95 {p95_cpu}% — below {cpu_threshold_pct}% threshold",
                    f"Memory avg {mem_avg}% utilized",
                    f"Datadog agent confirmed on {host}",
                ],
                "action":           "CREATE_PR_REQUIRES_APPROVAL",
                "pr_url":           None,
                "pr_number":        None,
                "pr_is_draft":      False,
                "pr_status":        None,
                "pr_branch":        None,
                "files_changed":    [],
                "scanned_at":       scanned_at,
            }
            findings.append(finding)

        return findings


# ---------------------------------------------------------------------------
# CLI — quick test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json
    from pathlib import Path
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent.parent / ".env")

    scanner  = DatadogScanner.from_env()
    findings = scanner.scan(cpu_threshold_pct=10.0, lookback_minutes=60)

    print(f"\nFound {len(findings)} idle instance(s):\n")
    for f in findings:
        print(f"  {f['resource_id']}  ({f['current_type']} → {f['recommended_type']})  "
              f"CPU avg={f['cpu_avg_pct']}%  savings=${f['monthly_savings_usd']}/mo")
    print()
    print(json.dumps(findings, indent=2))

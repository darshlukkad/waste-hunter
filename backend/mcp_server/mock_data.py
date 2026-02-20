"""
Mock Datadog telemetry data for FinOps Waste Hunter demo.

In production, this module would be replaced by live Datadog API calls:
  POST https://api.datadoghq.com/api/v1/query
  with metric: avg:aws.ec2.cpuutilization{*} by {host}
"""

from datetime import datetime, timedelta, timezone
import random

# ---------------------------------------------------------------------------
# Seed random for reproducible demo runs
# ---------------------------------------------------------------------------
random.seed(42)


def _gen_hourly_series(low: float, high: float, hours: int = 168) -> list[dict]:
    """Generate a 7-day hourly time series with light gaussian noise."""
    now = datetime.now(timezone.utc)
    return [
        {
            "timestamp": (now - timedelta(hours=(hours - i))).isoformat(),
            "value": round(max(0.0, random.uniform(low, high) + random.gauss(0, 0.2)), 2),
        }
        for i in range(hours)
    ]


# ---------------------------------------------------------------------------
# Primary mock payload — one idle m5.4xlarge burning $413/month in waste
# ---------------------------------------------------------------------------
MOCK_IDLE_RESOURCES: dict = {
    "source": "datadog_mock",
    "account_id": "123456789012",
    "region": "us-east-1",
    "idle_resources": [
        {
            "resource_id": "i-029da6afe1826bbba",
            "resource_type": "EC2",
            "instance_type": "t3.micro",
            "name": "wastehunter-rec-engine",
            "environment": "test",
            "team": "platform",
            "tags": {
                "Service": "recommendation-engine",
                "WasteHunter": "monitor",
                "Environment": "test",
            },
            "telemetry": {
                "window": "7d",
                "cpu": {
                    "avg_pct": 2.1,
                    "p95_pct": 5.4,
                    "p99_pct": 7.8,
                    "max_pct": 9.3,
                },
                "memory": {
                    "avg_pct": 12.3,
                    "p95_pct": 15.8,
                    "p99_pct": 17.2,
                    "max_pct": 19.1,
                },
                "network_in_mbps": {"avg": 0.2, "max": 0.8},
                "network_out_mbps": {"avg": 0.1, "max": 0.4},
            },
            "cost": {
                "current_type": "t3.micro",
                "current_vcpu": 2,
                "current_ram_gb": 1,
                "hourly_rate_usd": 0.0104,
                "monthly_cost_usd": 22.77,   # 3 instances × $7.59
                "recommended_type": "t3.nano",
                "recommended_vcpu": 2,
                "recommended_ram_gb": 0.5,
                "recommended_hourly_rate_usd": 0.0052,
                "recommended_monthly_cost_usd": 11.40,
                "projected_monthly_savings_usd": 11.37,
                "projected_annual_savings_usd": 136.44,
                "savings_pct": 49.9,
            },
            "idle_signal": {
                "confidence": "HIGH",
                "reasons": [
                    "CPU avg 2.1% over 7 days (threshold: <10%)",
                    "CPU p95 5.4% over 7 days (threshold: <10%)",
                    "Memory avg 12.3% over 7 days (threshold: <20%)",
                    "Network I/O avg < 0.5 Mbps",
                ],
            },
        }
    ],
    "summary": {
        "total_idle_resources": 1,
        "total_monthly_savings_usd": 11.37,
        "total_annual_savings_usd": 136.44,
    },
}


# ---------------------------------------------------------------------------
# Per-resource time-series cache (generated once, reused across tool calls)
# ---------------------------------------------------------------------------
_TIMESERIES_CACHE: dict[str, dict] = {
    "i-029da6afe1826bbba": {
        "cpu":         _gen_hourly_series(1.5, 3.2),
        "memory":      _gen_hourly_series(10.0, 14.5),
        "network_in":  _gen_hourly_series(0.1, 0.4),
        "network_out": _gen_hourly_series(0.05, 0.2),
    }
}


def get_timeseries(resource_id: str, metric: str) -> list[dict] | None:
    """Return cached hourly time-series for a resource/metric pair."""
    resource = _TIMESERIES_CACHE.get(resource_id)
    if resource is None:
        return None
    return resource.get(metric)

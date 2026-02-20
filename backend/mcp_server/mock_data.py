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
            "resource_id": "i-0a1b2c3d4e5f67890",
            "resource_type": "EC2",
            "instance_type": "m5.4xlarge",
            "name": "prod-api-server-03",
            "environment": "production",
            "team": "platform",
            "tags": {
                "Service": "recommendation-engine",
                "CostCenter": "eng-platform",
                "Owner": "alice@company.com",
            },
            "telemetry": {
                "window": "7d",
                "cpu": {
                    "avg_pct": 3.2,
                    "p95_pct": 8.1,
                    "p99_pct": 11.4,
                    "max_pct": 14.2,
                },
                "memory": {
                    "avg_pct": 14.7,
                    "p95_pct": 18.3,
                    "p99_pct": 21.1,
                    "max_pct": 23.4,
                },
                "network_in_mbps": {"avg": 0.8, "max": 2.1},
                "network_out_mbps": {"avg": 0.3, "max": 0.9},
            },
            "cost": {
                "current_type": "m5.4xlarge",
                "current_vcpu": 16,
                "current_ram_gb": 64,
                "hourly_rate_usd": 0.768,
                "monthly_cost_usd": 551.0,
                "recommended_type": "m5.xlarge",
                "recommended_vcpu": 4,
                "recommended_ram_gb": 16,
                "recommended_hourly_rate_usd": 0.192,
                "recommended_monthly_cost_usd": 138.0,
                "projected_monthly_savings_usd": 413.0,
                "projected_annual_savings_usd": 4956.0,
                "savings_pct": 74.96,
            },
            "idle_signal": {
                "confidence": "HIGH",
                "reasons": [
                    "CPU avg 3.2% over 7 days (threshold: <10%)",
                    "CPU p95 8.1% over 7 days (threshold: <10%)",
                    "Memory avg 14.7% over 7 days (threshold: <20%)",
                    "Network I/O avg < 1 Mbps",
                ],
            },
        }
    ],
    "summary": {
        "total_idle_resources": 1,
        "total_monthly_savings_usd": 413.0,
        "total_annual_savings_usd": 4956.0,
    },
}


# ---------------------------------------------------------------------------
# Per-resource time-series cache (generated once, reused across tool calls)
# ---------------------------------------------------------------------------
_TIMESERIES_CACHE: dict[str, dict] = {
    "i-0a1b2c3d4e5f67890": {
        "cpu":         _gen_hourly_series(2.0, 4.5),
        "memory":      _gen_hourly_series(13.0, 17.5),
        "network_in":  _gen_hourly_series(0.5, 1.2),
        "network_out": _gen_hourly_series(0.2, 0.5),
    }
}


def get_timeseries(resource_id: str, metric: str) -> list[dict] | None:
    """Return cached hourly time-series for a resource/metric pair."""
    resource = _TIMESERIES_CACHE.get(resource_id)
    if resource is None:
        return None
    return resource.get(metric)

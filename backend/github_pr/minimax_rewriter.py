"""
Minimalist — MiniMax IaC Rewriter (Phase 3)
=====================================================
Uses the MiniMax M2 API for code generation to rewrite Terraform (.tf) and
Kubernetes YAML files, downsizing an EC2 instance to the recommended type.

MiniMax is used specifically here because it is the sponsor-track requirement
for code generation / multimodal output.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
_API_KEY   = os.environ.get("MINIMAX_API_KEY", "")
_GROUP_ID  = os.environ.get("MINIMAX_GROUP_ID", "")
_BASE_URL  = "https://api.minimax.io/v1"
_MODEL     = "MiniMax-Text-01"
_TIMEOUT   = 120  # seconds


# ---------------------------------------------------------------------------
# Internal helper
# ---------------------------------------------------------------------------
def _chat(system: str, user: str) -> str:
    """
    Call MiniMax chat completion (OpenAI-compatible endpoint) and return text.

    MiniMax international API uses /v1/chat/completions with OpenAI-style
    request/response schema. The legacy /v1/text/chatcompletion_v2 endpoint
    requires a different auth scheme (GroupId + different key format).
    """
    url = f"{_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "max_tokens": 2048,
        "temperature": 0.05,   # low temp — we want deterministic code output
        "top_p": 0.9,
    }

    resp = httpx.post(url, json=payload, headers=headers, timeout=_TIMEOUT)
    data = resp.json()

    # Check for API-level errors before raising on HTTP status
    if "base_resp" in data and data["base_resp"].get("status_code", 0) != 0:
        raise RuntimeError(
            f"MiniMax API error {data['base_resp']['status_code']}: "
            f"{data['base_resp'].get('status_msg', 'unknown')}"
        )
    resp.raise_for_status()

    # OpenAI-compatible response: choices[0].message.content
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise RuntimeError(f"Unexpected MiniMax response shape: {data}") from exc


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def _rewrite_terraform_local(content: str, from_type: str, to_type: str) -> str:
    """Fast local fallback — replace instance_type string directly."""
    import re
    # Replace quoted instance_type value
    result = re.sub(
        r'(instance_type\s*=\s*")[^"]*(")',
        rf'\g<1>{to_type}\2  # WasteHunter: downsized from {from_type}',
        content,
    )
    if result == content:
        # No match found — append a comment and do a plain replace
        result = content.replace(f'"{from_type}"', f'"{to_type}"  # WasteHunter: downsized from {from_type}')
    return result


def rewrite_terraform(
    current_content: str,
    from_type: str,
    to_type: str,
    resource_name: str = "prod-api-server-03",
) -> str:
    """
    Use MiniMax to rewrite a Terraform file, changing instance_type
    from from_type to to_type. Falls back to local string replace on timeout.

    Returns the full rewritten .tf file content as a string.
    """
    system = (
        "You are a Terraform expert. Your task is to rewrite a Terraform file "
        "to downsize an EC2 instance. "
        "Return ONLY the complete, valid Terraform HCL content — no explanation, "
        "no markdown fences, no commentary. The output must be a drop-in "
        "replacement for the original file."
    )
    user = (
        f"Rewrite the following Terraform file to change the EC2 instance "
        f"'{resource_name}' from instance_type \"{from_type}\" to \"{to_type}\".\n\n"
        f"Add a comment on the changed line: "
        f"# WasteHunter: downsized from {from_type} — saves $413/month\n\n"
        f"--- ORIGINAL FILE ---\n{current_content}\n--- END ---"
    )
    try:
        result = _chat(system, user)
        print(f"  ✅ MiniMax rewrote Terraform successfully")
        return result
    except Exception as exc:
        print(f"  ⚠️  MiniMax timed out ({exc}), using local string replace fallback")
        return _rewrite_terraform_local(current_content, from_type, to_type)


def rewrite_k8s(
    current_content: str,
    from_cpu_request: str = "4000m",
    to_cpu_request: str = "200m",
    from_mem_request: str = "16Gi",
    to_mem_request: str = "2Gi",
    from_cpu_limit: str = "8000m",
    to_cpu_limit: str = "500m",
    from_mem_limit: str = "32Gi",
    to_mem_limit: str = "4Gi",
) -> str:
    """
    Use MiniMax to rewrite a Kubernetes Deployment YAML, downsizing
    resource requests and limits to match actual observed utilisation.

    Returns the full rewritten YAML content as a string.
    """
    system = (
        "You are a Kubernetes expert. Your task is to rewrite a Deployment YAML "
        "to right-size resource requests and limits based on observed usage. "
        "Return ONLY the complete, valid YAML content — no explanation, "
        "no markdown fences, no commentary."
    )
    user = (
        "Rewrite the following Kubernetes Deployment YAML to update resource "
        "requests and limits:\n"
        f"  CPU request:  {from_cpu_request} → {to_cpu_request}  "
        f"# WasteHunter: actual avg < 200m\n"
        f"  Memory request: {from_mem_request} → {to_mem_request}  "
        f"# WasteHunter: actual avg ~2.4Gi\n"
        f"  CPU limit:    {from_cpu_limit} → {to_cpu_limit}\n"
        f"  Memory limit: {from_mem_limit} → {to_mem_limit}\n\n"
        "Add a comment block at the top of the file:\n"
        "# WasteHunter Auto-Resize: generated by Minimalist\n"
        "# Previous requests were 20x actual usage. Estimated savings: $413/month.\n\n"
        f"--- ORIGINAL FILE ---\n{current_content}\n--- END ---"
    )
    return _chat(system, user)


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    from pathlib import Path

    tf_path   = Path(__file__).parent.parent.parent / "infra" / "terraform" / "main.tf"
    yaml_path = Path(__file__).parent.parent.parent / "infra" / "k8s" / "deployment.yaml"

    print("=== Rewriting Terraform via MiniMax ===")
    tf_result = rewrite_terraform(
        tf_path.read_text(),
        from_type="m5.4xlarge",
        to_type="m5.xlarge",
    )
    print(tf_result[:800], "…")

    print("\n=== Rewriting Kubernetes YAML via MiniMax ===")
    k8s_result = rewrite_k8s(yaml_path.read_text())
    print(k8s_result[:800], "…")

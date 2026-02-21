"""
Minimalist — Neo4j Blast Radius Checker (Phase 2)
===========================================================
Queries the Neo4j knowledge graph to determine whether it is safe to
downsize a given AWS resource.

Two queries are run:
  1. Dependency traversal  — find all resources connected within N hops
  2. Memory lookup         — check for previously rejected actions on this resource

Risk scoring:
  CRITICAL  → HIGH-criticality dependency found (RDS, LoadBalancer)
  MEDIUM    → MEDIUM-criticality dependency or a past rejected action found
  LOW       → only LOW or no dependencies; proceed with caution
  SAFE      → no dependencies; safe to downsize immediately

Usage:
  checker = BlastRadiusChecker.from_env()
  result  = checker.check("i-0a1b2c3d4e5f67890")
  print(result)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

from dotenv import load_dotenv
from neo4j import GraphDatabase, Driver

load_dotenv()


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass
class Dependency:
    node_id: str
    node_type: str
    name: str
    criticality: str
    relationship: str
    hops: int


@dataclass
class BlastRadiusResult:
    resource_id: str
    risk_level: str                          # SAFE | LOW | MEDIUM | CRITICAL
    safe_to_proceed: bool
    dependencies: list[Dependency] = field(default_factory=list)
    rejected_actions: list[dict] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)
    recommendation: str = ""

    def to_dict(self) -> dict:
        return {
            "resource_id": self.resource_id,
            "risk_level": self.risk_level,
            "safe_to_proceed": self.safe_to_proceed,
            "dependency_count": len(self.dependencies),
            "dependencies": [
                {
                    "id": d.node_id,
                    "type": d.node_type,
                    "name": d.name,
                    "criticality": d.criticality,
                    "relationship": d.relationship,
                    "hops": d.hops,
                }
                for d in self.dependencies
            ],
            "rejected_actions": self.rejected_actions,
            "reasons": self.reasons,
            "recommendation": self.recommendation,
        }


# ---------------------------------------------------------------------------
# Blast Radius Checker
# ---------------------------------------------------------------------------
class BlastRadiusChecker:
    """Query Neo4j to assess the blast radius of a proposed downsize action."""

    def __init__(self, driver: Driver):
        self._driver = driver

    # ── Factory ──────────────────────────────────────────────────────────────
    @classmethod
    def from_env(cls) -> "BlastRadiusChecker":
        uri      = os.environ["NEO4J_URI"]
        username = os.environ.get("NEO4J_USERNAME", "neo4j")
        password = os.environ["NEO4J_PASSWORD"]
        driver   = GraphDatabase.driver(uri, auth=(username, password))
        driver.verify_connectivity()
        return cls(driver)

    def close(self):
        self._driver.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    # ── Public API ───────────────────────────────────────────────────────────
    def check(self, resource_id: str, max_hops: int = 2) -> BlastRadiusResult:
        """
        Run a full blast-radius check for resource_id.

        Steps:
          1. Traverse up to max_hops relationships to find dependencies.
          2. Look up any previously rejected actions (agent long-term memory).
          3. Score and return a BlastRadiusResult.
        """
        dependencies    = self._get_dependencies(resource_id, max_hops)
        rejected        = self._get_rejected_actions(resource_id)
        risk, reasons   = self._score(dependencies, rejected)

        safe            = risk in ("SAFE", "LOW")
        recommendation  = self._build_recommendation(risk, dependencies, rejected)

        return BlastRadiusResult(
            resource_id=resource_id,
            risk_level=risk,
            safe_to_proceed=safe,
            dependencies=dependencies,
            rejected_actions=rejected,
            reasons=reasons,
            recommendation=recommendation,
        )

    def seed_schema(self, cypher_path: str) -> None:
        """Run the schema.cypher seed file against the connected database."""
        with open(cypher_path) as f:
            raw = f.read()

        # Split on ';', strip comment lines from each chunk, keep non-empty Cypher
        statements = []
        for chunk in raw.split(";"):
            # Remove comment-only lines, keep Cypher lines
            cypher_lines = [
                line for line in chunk.splitlines()
                if line.strip() and not line.strip().startswith("//")
            ]
            stmt = "\n".join(cypher_lines).strip()
            if stmt:
                statements.append(stmt)

        with self._driver.session() as session:
            for stmt in statements:
                session.run(stmt)
        print(f"✅  Schema seeded ({len(statements)} statements) from {cypher_path}")

    # ── Private helpers ──────────────────────────────────────────────────────
    def _get_dependencies(self, resource_id: str, max_hops: int) -> list[Dependency]:
        # Neo4j does not allow parameters as relationship range bounds (r*1..$n),
        # so we embed the validated integer literal directly into the query string.
        hops = max(1, min(int(max_hops), 5))  # clamp to 1–5 for safety
        query = f"""
        MATCH path = (root {{id: $resource_id}})-[r*1..{hops}]-(dep)
        WHERE dep.id <> $resource_id
        WITH dep,
             length(path)                          AS hops,
             type(last(relationships(path)))       AS rel_type,
             labels(dep)[0]                        AS node_type
        RETURN DISTINCT
               dep.id                              AS node_id,
               node_type,
               coalesce(dep.name, dep.id)          AS name,
               coalesce(dep.criticality, 'LOW')    AS criticality,
               rel_type                            AS relationship,
               hops
        ORDER BY hops ASC, criticality DESC
        """
        with self._driver.session() as session:
            records = session.run(query, resource_id=resource_id)
            return [
                Dependency(
                    node_id=r["node_id"],
                    node_type=r["node_type"],
                    name=r["name"],
                    criticality=r["criticality"],
                    relationship=r["relationship"],
                    hops=r["hops"],
                )
                for r in records
            ]

    def _get_rejected_actions(self, resource_id: str) -> list[dict]:
        query = """
        MATCH (n {id: $resource_id})-[:HAS_REJECTED_ACTION]->(ra:RejectedAction)
        RETURN ra.id          AS id,
               ra.action      AS action,
               ra.from_type   AS from_type,
               ra.to_type     AS to_type,
               ra.rejected_by AS rejected_by,
               ra.reason      AS reason,
               ra.rejected_at AS rejected_at,
               ra.status      AS status
        ORDER BY ra.rejected_at DESC
        """
        with self._driver.session() as session:
            records = session.run(query, resource_id=resource_id)
            return [dict(r) for r in records]

    def _score(
        self,
        deps: list[Dependency],
        rejected: list[dict],
    ) -> tuple[str, list[str]]:
        reasons: list[str] = []

        if not deps and not rejected:
            return "SAFE", ["No dependencies found. Safe to downsize immediately."]

        # Check for CRITICAL deps
        critical_deps = [d for d in deps if d.criticality == "HIGH"]
        if critical_deps:
            for d in critical_deps:
                reasons.append(
                    f"HIGH-criticality {d.node_type} '{d.name}' "
                    f"is connected via {d.relationship} ({d.hops} hop(s))"
                )
            return "CRITICAL", reasons

        # Check for past rejected actions (agent memory)
        if rejected:
            for ra in rejected:
                reasons.append(
                    f"Previous action REJECTED by {ra['rejected_by']}: "
                    f"\"{ra['reason']}\""
                )

        # Medium-criticality deps
        medium_deps = [d for d in deps if d.criticality == "MEDIUM"]
        if medium_deps or rejected:
            for d in medium_deps:
                reasons.append(
                    f"MEDIUM-criticality {d.node_type} '{d.name}' "
                    f"connected via {d.relationship}"
                )
            return "MEDIUM", reasons

        # Only LOW deps
        for d in deps:
            reasons.append(
                f"LOW-criticality {d.node_type} '{d.name}' connected "
                f"via {d.relationship} — acceptable risk"
            )
        return "LOW", reasons

    def _build_recommendation(
        self,
        risk: str,
        deps: list[Dependency],
        rejected: list[dict],
    ) -> str:
        if risk == "SAFE":
            return "No dependencies detected. Proceed with downsize and auto-merge PR."
        if risk == "LOW":
            return (
                "Only low-criticality dependencies found. "
                "Proceed with PR — require human approval before merge."
            )
        if risk == "MEDIUM":
            msgs = []
            if rejected:
                msgs.append("A previous downsize was rejected for this resource.")
            msgs.append(
                "Medium-risk dependencies present. "
                "Create PR but tag owner for mandatory review before merge."
            )
            return " ".join(msgs)
        # CRITICAL
        critical_names = [d.name for d in deps if d.criticality == "HIGH"]
        return (
            f"CRITICAL dependencies detected: {', '.join(critical_names)}. "
            "Do NOT auto-create PR. Escalate to team owner for manual review."
        )


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import json

    print("Connecting to Neo4j Aura…")
    with BlastRadiusChecker.from_env() as checker:
        # Optionally seed the schema first
        import sys
        from pathlib import Path

        cypher = Path(__file__).parent / "schema.cypher"
        if "--seed" in sys.argv:
            checker.seed_schema(str(cypher))

        result = checker.check("i-0a1b2c3d4e5f67890")
        print(json.dumps(result.to_dict(), indent=2, default=str))

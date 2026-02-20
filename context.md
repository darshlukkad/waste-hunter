# FinOps Waste Hunter — Full Project Context

> **Hackathon**: AWS × Anthropic × Datadog GenAI Hackathon
> **Goal**: Autonomous agentic workflow that finds structural cloud waste, validates safety via a Neo4j knowledge graph, rewrites IaC with MiniMax AI, opens GitHub PRs, and lets engineers approve/reject via a CopilotKit-powered human-in-the-loop UI.

---

## Current Status (as of Feb 2026)

### ✅ Fully Working
| Area | Status |
|---|---|
| FastAPI backend (port 8000) | Running |
| Datadog real CPU scanner | Working — queries last N minutes of CPU, flags idle instances |
| Neo4j blast radius checker | Working |
| MiniMax IaC rewriter | Working — rewrites Terraform + K8s YAML |
| GitHub PR creator | Working — opens PR on `darshlukkad/waste-hunter-dummy` |
| CopilotKit runtime (self-hosted, Bedrock) | Working — uses BedrockAdapter, NO Anthropic key needed |
| Next.js frontend (port 3000) | Running |
| Approve / Reject PR flow | Working — merges or closes GitHub PR |
| Create PR button | Working — triggers MiniMax rewrite + GitHub PR creation on demand |
| Infinite re-render fix | Fixed — useMemo + useCallback in trigger-detail-view |

---

## Repository Structure (Actual)

```
WasteHunter/
├── context.md                            # This file — full project context
├── backend/
│   ├── .env                              # All backend secrets (see env section)
│   ├── .env.example                      # Example env template
│   ├── requirements.txt                  # Python dependencies
│   ├── .venv/                            # Python 3.13 venv
│   ├── api/
│   │   └── server.py                     # FastAPI REST API — all endpoints
│   ├── agent/
│   │   └── waste_hunter.py               # Bedrock agentic loop (standalone, 5 tools)
│   ├── graph/
│   │   ├── blast_radius.py               # BlastRadiusChecker — Neo4j Aura queries
│   │   └── schema.cypher                 # Seed data for Neo4j Aura graph
│   ├── github_pr/
│   │   ├── minimax_rewriter.py           # MiniMax-Text-01 rewrites Terraform + K8s YAML
│   │   └── pr_creator.py                 # PRCreator — creates GitHub PR via PyGithub
│   ├── mcp_server/
│   │   ├── server.py                     # FastMCP server (5 tools for agent)
│   │   └── mock_data.py                  # Mock Datadog telemetry (used by agent loop)
│   └── scanner/
│       └── datadog_scanner.py            # Real Datadog API scanner (used by /api/scan)
├── frontend/
│   ├── .env                              # Frontend env vars (NEXT_PUBLIC_BACKEND_URL + AWS)
│   ├── package.json                      # Next.js 16.1.6, React 19, CopilotKit 1.51.4
│   ├── app/
│   │   ├── layout.tsx                    # Root layout — wraps with <Providers>, suppressHydrationWarning on <body>
│   │   ├── providers.tsx                 # CopilotKit provider ("use client") runtimeUrl="/api/copilotkit"
│   │   ├── page.tsx                      # Dashboard — lists all active triggers
│   │   ├── globals.css                   # Tailwind v4 global styles
│   │   ├── api/
│   │   │   └── copilotkit/
│   │   │       └── route.ts              # Self-hosted CopilotKit runtime (BedrockAdapter + delegateAgentProcessingToServiceAdapter)
│   │   └── trigger/
│   │       └── [id]/
│   │           └── page.tsx              # Trigger detail page (SSR shell)
│   ├── components/
│   │   ├── triggers-list.tsx             # Dashboard list — Scan Now button + findings list
│   │   ├── trigger-detail-client.tsx     # Client wrapper — useFinding polling hook
│   │   ├── trigger-detail-view.tsx       # Full detail view — useCopilotReadable, useCopilotAction, CopilotPopup
│   │   ├── pr-action-panel.tsx           # Create PR / Approve / Reject panel
│   │   ├── ai-reasoning.tsx              # AI analysis evidence display
│   │   ├── code-diff.tsx                 # IaC code changes display
│   │   ├── workflow-status.tsx           # Pipeline step progress display
│   │   ├── analytics-section.tsx         # Summary metrics
│   │   ├── top-nav.tsx                   # Header with theme toggle
│   │   └── ui/                           # shadcn/ui primitives
│   ├── hooks/
│   │   └── use-findings.ts               # useFindings (list, 15s poll) + useFinding (single, 10s poll)
│   └── lib/
│       ├── data.ts                       # TypeScript interfaces: Trigger, WorkflowState, WorkflowStep, BlastRisk, TriggerStatus
│       ├── backend.ts                    # API client: fetchFindings, fetchFinding, triggerScan, createPr, approveFinding, rejectFinding, mapFindingToTrigger
│       └── utils.ts                      # cn() helper
└── infra/
    ├── terraform/main.tf                 # Demo Terraform file (seeded to GitHub repo, rewritten by MiniMax)
    └── k8s/deployment.yaml               # Demo K8s file (seeded to GitHub repo, rewritten by MiniMax)
```

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| AI Orchestration | Amazon Bedrock | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` cross-region inference |
| CopilotKit LLM | Amazon Bedrock | `us.anthropic.claude-3-5-haiku-20241022-v1:0` via BedrockAdapter |
| Tool Protocol | MCP (Model Context Protocol) | FastMCP server — 5 tools |
| Telemetry | Datadog Metrics API v1 | `avg:system.cpu.user{managed_by:wastehunter} by {host}` |
| Dependency Graph | Neo4j Aura | Blast radius assessment + rejection memory |
| IaC Rewriting | MiniMax `MiniMax-Text-01` | `https://api.minimax.io/v1/chat/completions` |
| PR Automation | GitHub API | PyGithub — creates branch + commits + PR |
| Backend API | FastAPI + uvicorn | Python 3.13, port 8000 |
| Frontend Framework | Next.js 16.1.6 App Router | React 19, TypeScript 5.7.3 |
| AI Chat UI | CopilotKit 1.51.4 | Self-hosted runtime, BedrockAdapter, CopilotPopup |
| Styling | Tailwind CSS v4 + shadcn/ui | Dark mode default, next-themes |
| Real Infra | AWS EC2 (t3.micro × 3) | ALB, ASG, CloudWatch, Datadog agent, us-west-2 |

---

## Environment Variables

### `backend/.env`
```
# AWS Bedrock (credential chain from ~/.aws/credentials OR explicit)
AWS_DEFAULT_REGION=us-west-2

# Neo4j Aura (Phase 2 — Blast Radius)
NEO4J_URI=neo4j+s://ef15a093.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<secret>

# MiniMax (Phase 3 — IaC rewrite)
MINIMAX_API_KEY=<secret>
MINIMAX_GROUP_ID=2024721252354101384

# GitHub (Phase 3 — PR creation)
GITHUB_TOKEN=<secret>
GITHUB_REPO=darshlukkad/waste-hunter-dummy

# Datadog (real scanner)
DATADOG_API_KEY=<secret>
DATADOG_APP_KEY=<secret>
DATADOG_SITE=datadoghq.com
```

### `frontend/.env`
```
# Backend URL (proxy to FastAPI)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000

# AWS credentials for CopilotKit BedrockAdapter (used server-side in route.ts)
AWS_ACCESS_KEY_ID=<secret>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_REGION=us-west-2
```

**Important**: The frontend does NOT use `ANTHROPIC_API_KEY`. CopilotKit is wired to AWS Bedrock via `BedrockAdapter`.

---

## How to Run

```bash
# Terminal 1 — FastAPI backend
cd backend
.venv/bin/uvicorn api.server:app --reload --port 8000

# Terminal 2 — Next.js frontend
cd frontend
npm run dev
```

- Dashboard:              http://localhost:3000
- Trigger detail:         http://localhost:3000/trigger/i-029da6afe1826bbba
- Backend health:         http://localhost:8000/api/health
- Backend findings:       http://localhost:8000/api/findings
- Swagger UI:             http://localhost:8000/docs

---

## Backend API Endpoints (Complete)

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check — returns `{status: "ok", timestamp}` |
| GET | `/api/findings` | All findings with current PR status merged in |
| GET | `/api/findings/{resource_id}` | Single finding by EC2 instance ID |
| POST | `/api/approve/{resource_id}` | Merge GitHub PR via PyGithub squash merge |
| POST | `/api/reject/{resource_id}` | Close GitHub PR + write `RejectedAction` node to Neo4j |
| POST | `/api/scan` | Query Datadog for idle instances, add/update FINDINGS |
| POST | `/api/create_pr/{resource_id}` | MiniMax IaC rewrite + GitHub PR creation for a finding |

### Request Bodies
```
POST /api/reject/{resource_id}
  { "reason": "string", "rejected_by": "string" }

POST /api/scan
  { "cpu_threshold_pct": 10.0, "lookback_minutes": 60, "tag_filter": "managed_by:wastehunter" }

POST /api/create_pr/{resource_id}
  (no body — uses in-memory finding data)
```

### In-memory State
The server uses `FINDINGS: list[dict]` and `PR_STATUS: dict[str, str]` for state. These are seeded at startup with one real finding for `i-029da6afe1826bbba`. New findings are added by `/api/scan`. State resets on server restart.

---

## Real AWS Infrastructure

```
Account:    318265007132 (personal, us-west-2)
Region:     us-west-2
ALB DNS:    wastehunter-alb-531314747.us-west-2.elb.amazonaws.com
ASG:        wastehunter-asg  (min=3, desired=3, max=6)
Tag:        managed_by:wastehunter  (used by Datadog scanner filter)

Instance IDs (all t3.micro, Name=wastehunter-rec-engine):
  i-029da6afe1826bbba
  i-030a14838974430e7
  i-03e3a5ce0a14eaa82
```

### Datadog Metrics
- All 3 instances are tagged `managed_by:wastehunter` in Datadog
- `system.cpu.user` avg ≈ 0.56% (well below 10% threshold)
- 147 data points per hour
- Metric: `avg:system.cpu.user{managed_by:wastehunter} by {host}`
- Memory: `avg:system.mem.pct_usable{managed_by:wastehunter} by {host}`

### Scope Parsing (important)
Datadog returns scope strings like `host:i-029da6afe1826bbba,managed_by:wastehunter`.
The scanner uses `_extract_host()` to split on `,` and find the `host:` prefix.
Without this, resource_id would be the full scope string including the tag.

---

## Agent Pipeline (Standalone — `backend/agent/waste_hunter.py`)

The Bedrock agent runs a 5-tool agentic loop. It is separate from the API server and can be run standalone:

```bash
cd backend
.venv/bin/python -m agent.waste_hunter
```

```
Tool 1: get_idle_resources     → Mock Datadog scan → returns idle instances from mock_data.py
Tool 2: get_resource_telemetry → 7-day hourly timeseries for CPU/memory/network
Tool 3: check_blast_radius     → Neo4j graph traversal → SAFE/LOW/MEDIUM/CRITICAL + reasons
Tool 4: rewrite_iac            → MiniMax rewrites infra/terraform/main.tf + infra/k8s/deployment.yaml
Tool 5: create_github_pr       → Opens PR on darshlukkad/waste-hunter-dummy via PRCreator
```

**Note**: The agent uses `mock_data.py` for `get_idle_resources`. The real Datadog scanner (`scanner/datadog_scanner.py`) is wired into the `/api/scan` REST endpoint, NOT the agent loop.

---

## Datadog Scanner (`backend/scanner/datadog_scanner.py`)

Called by `POST /api/scan`. Queries real Datadog metrics:

```python
DatadogScanner.from_env()   # reads DATADOG_API_KEY, DATADOG_APP_KEY, DATADOG_SITE
scanner.scan(
    tag_filter="managed_by:wastehunter",
    cpu_threshold_pct=10.0,
    lookback_minutes=60,
)
```

Returns findings matching the `BackendFinding` schema. EC2 instance metadata is enriched via `boto3.client("ec2").describe_instances()`. Falls back to `KNOWN_INSTANCE_NAMES` static map if EC2 API fails.

Pricing and downsize maps are hardcoded for us-west-2 on-demand Linux pricing.

---

## GitHub PR Creator (`backend/github_pr/pr_creator.py`)

Called by `/api/create_pr/{resource_id}`. Full pipeline:

```
1. _ensure_base_files()     → seeds infra/terraform/main.tf + infra/k8s/deployment.yaml to main branch if missing
2. _get_file_content()      → reads current file content from main branch
3. rewrite_terraform()      → MiniMax rewrites .tf (changes instance_type)
4. rewrite_k8s()            → MiniMax rewrites deployment.yaml (right-sizes requests/limits)
5. _create_branch()         → creates branch waste-hunter/downsize-{resource_id}
6. _update_file() × 2       → commits both files to branch
7. _open_pr()               → creates PR with full savings + blast risk table in body
```

CRITICAL blast risk → PR opened as draft. Others → normal open PR.

---

## MiniMax Rewriter (`backend/github_pr/minimax_rewriter.py`)

Uses `MiniMax-Text-01` model at `https://api.minimax.io/v1/chat/completions`.

- `rewrite_terraform(content, from_type, to_type, resource_name)` → returns full .tf with updated `instance_type`
- `rewrite_k8s(content)` → returns full YAML with right-sized `resources.requests` and `resources.limits`

Temperature: 0.05 (deterministic code output). Timeout: 60s.

---

## CopilotKit Integration

### Architecture
```
frontend/app/providers.tsx
  └── <CopilotKit runtimeUrl="/api/copilotkit">
        └── wraps entire app

frontend/app/api/copilotkit/route.ts
  └── POST handler (Next.js App Router)
  └── BedrockAdapter(model="us.anthropic.claude-3-5-haiku-20241022-v1:0", region="us-west-2")
  └── CopilotRuntime({ delegateAgentProcessingToServiceAdapter: true })
      ← CRITICAL: without this flag, v1.51.4 throws "Agent 'default' not found"
  └── copilotRuntimeNextJSAppRouterEndpoint(...)
```

### Hooks used in `trigger-detail-view.tsx`
```tsx
// Memoized — prevents infinite re-render loop
const findingValue = useMemo(() => ({ ...trigger fields }), [deps])
useCopilotReadable({ description: "...", value: findingValue })

// Memoized handlers
const handleApprove = useCallback(async () => { ... }, [deps])
const handleReject  = useCallback(async ({ reason }) => { ... }, [deps])
useCopilotAction({ name: "approveFinding", handler: handleApprove })
useCopilotAction({ name: "rejectFinding",  handler: handleReject  })

// Floating chat popup
<CopilotPopup instructions="..." labels={{ title: "WasteHunter Copilot", initial: "..." }} />
```

The Copilot can call `approveFinding()` or `rejectFinding(reason)` via natural language.

---

## Frontend Data Flow

```
Page: /
  └── app/page.tsx (static shell)
      └── components/triggers-list.tsx
          └── useFindings() hook → polls GET /api/findings every 15s
          └── "Scan Now" button → POST /api/scan → adds new findings
          └── renders list of trigger cards → links to /trigger/[id]

Page: /trigger/[id]
  └── app/trigger/[id]/page.tsx (SSR shell)
      └── components/trigger-detail-client.tsx
          └── useFinding(id) hook → polls GET /api/findings/{id} every 10s
          └── onActionComplete = refetch (stable useCallback)
          └── components/trigger-detail-view.tsx
              ├── CopilotKit hooks (useCopilotReadable, useCopilotAction × 2)
              ├── components/pr-action-panel.tsx
              │   ├── if no prUrl: shows "Create PR" button → POST /api/create_pr/{id}
              │   └── if prUrl:    shows Approve / Reject buttons
              ├── components/workflow-status.tsx   → pipeline step progress
              ├── components/ai-reasoning.tsx      → evidence list
              ├── components/code-diff.tsx         → IaC changes
              └── <CopilotPopup> (floating AI chat)
```

### `mapFindingToTrigger()` in `frontend/lib/backend.ts`
Converts `BackendFinding` (snake_case) → `Trigger` (camelCase). Derives:
- `status` from `pr_status` (merged→approved, closed→rejected, open→pr_ready, else→detected)
- `workflow` (5 pipeline steps with complete/active/pending states)
- `aiReasoning` from `evidence` + `blast_reasons` arrays
- `copilotSummary` one-line summary for CopilotKit initial message

---

## Key Bugs Fixed

### 1. CopilotKit "Agent 'default' not found" (v1.51.4)
`CopilotRuntime` in v1.51.4 requires registered LangGraph agents. Without them it throws:
```
useAgent: Agent 'default' not found after runtime sync. No agents registered.
```
**Fix**: Pass `{ delegateAgentProcessingToServiceAdapter: true }` to `CopilotRuntime` constructor.

### 2. React Infinite Re-render Loop
`useCopilotReadable` and `useCopilotAction` in `trigger-detail-view.tsx` received new object/function references on every render. CopilotKit detected the changes, updated internal state, triggered re-render → loop.
**Fix**: Wrap readable value in `useMemo`, wrap action handlers in `useCallback`.

### 3. React Hydration Mismatch
Grammarly browser extension injects `data-new-gr-c-s-check-loaded` and `data-gr-ext-installed` attributes into `<body>` after SSR, causing mismatch.
**Fix**: Add `suppressHydrationWarning` to `<body>` in `app/layout.tsx`.

### 4. Datadog Scope Parsing
Datadog returns scope like `host:i-029da6afe1826bbba,managed_by:wastehunter`. Naively splitting gives wrong `resource_id`.
**Fix**: `_extract_host()` splits on `,`, finds part starting with `host:`, strips the prefix.

### 5. EC2 AuthFailure
`boto3.client("ec2").describe_instances()` failed with AuthFailure when scanner ran with explicit IAM credentials.
**Fix**: Use default credential chain. Fall back to `KNOWN_INSTANCE_NAMES` static map for the 3 ASG instances.

### 6. PR Creation Not Wired to Scan
`POST /api/scan` only detected idle instances — no PRs were created. PRCreator lived only inside the standalone agent.
**Fix**: Added `POST /api/create_pr/{resource_id}` endpoint + "Create PR" button in `pr-action-panel.tsx`.

### 7. `neo4j/` Package Shadow (historical)
Directory named `neo4j/` shadowed the installed `neo4j` pip package.
**Fix**: Renamed to `graph/` everywhere.

### 8. Bedrock Model ID
Must use `us.` prefix + `:0` suffix for cross-region inference profile.
`us.anthropic.claude-3-5-sonnet-20241022-v2:0` — Bedrock agent
`us.anthropic.claude-3-5-haiku-20241022-v1:0` — CopilotKit BedrockAdapter

### 9. MiniMax API Endpoint
Correct endpoint: `https://api.minimax.io/v1/chat/completions`
(not `minimaxi.com`, not `minimax.chat`, not the legacy `chatcompletion_v2` path)

### 10. Neo4j Cypher Range Parameter
`[r*1..$max_hops]` fails — parameters can't be range bounds in Cypher.
**Fix**: Use f-string: `f"[r*1..{hops}]"`

---

## Dummy GitHub Repo (`darshlukkad/waste-hunter-dummy`)

Separate repo used as the target for PR creation. Contains:
```
infra/terraform/main.tf         ← seeded from local WasteHunter/infra/terraform/main.tf
infra/k8s/deployment.yaml       ← seeded from local WasteHunter/infra/k8s/deployment.yaml
app/rec_engine.py               ← idle HTTP server (port 8080), stdlib only
```

The `PRCreator` seeds these files if they don't exist, then overwrites them with MiniMax output on a new branch, then opens a PR targeting `main`.

---

## Neo4j Blast Radius Graph (`backend/graph/blast_radius.py`)

Neo4j Aura instance at `neo4j+s://ef15a093.databases.neo4j.io`.

`BlastRadiusChecker.check(resource_id, max_hops=2)` returns:
```python
BlastRadiusResult(
    risk="SAFE|LOW|MEDIUM|CRITICAL",
    reasons=["..."],
    dependencies=[{"id": "...", "type": "...", "criticality": "..."}]
)
```

Risk levels: no dependencies → SAFE, low criticality → LOW, medium → MEDIUM, any CRITICAL dependency → CRITICAL.

On rejection, `RejectedAction` nodes are written to Neo4j so the agent remembers previous human decisions.

---

## Instance Pricing Reference (us-west-2, Linux on-demand)

| Type | $/hr | $/mo (730h) |
|---|---|---|
| t3.nano | $0.0052 | $3.80 |
| t3.micro | $0.0104 | $7.59 |
| t3.small | $0.0208 | $15.18 |
| t3.medium | $0.0416 | $30.37 |
| t3.large | $0.0832 | $60.74 |
| m5.large | $0.0960 | $70.08 |
| c5.large | $0.0850 | $62.05 |

Downsize map: `t3.micro → t3.nano`, `t3.small → t3.micro`, `t3.medium → t3.small`, etc.

---

## Seeded Demo Finding (server.py startup state)

```python
FINDINGS = [{
    "resource_id": "i-029da6afe1826bbba",
    "name": "wastehunter-rec-engine",
    "service": "Recommendation Engine",
    "region": "us-west-2",
    "current_type": "t3.micro",
    "recommended_type": "t3.nano",
    "monthly_savings_usd": 11.37,
    "annual_savings_usd": 136.44,
    "blast_risk": "LOW",
    "pr_url": "https://github.com/darshlukkad/waste-hunter-dummy/pull/1",
    "pr_number": 1,
    "pr_status": "open",
    ...
}]
```

Additional findings are added at runtime by `POST /api/scan` from the Datadog scanner.

---

## Known Instance Names (static fallback)

```python
KNOWN_INSTANCE_NAMES = {
    "i-029da6afe1826bbba": "wastehunter-rec-engine",
    "i-030a14838974430e7": "wastehunter-rec-engine",
    "i-03e3a5ce0a14eaa82": "wastehunter-rec-engine",
}
```

All 3 ASG instances run the same `rec_engine.py` app and are tagged `managed_by:wastehunter`.

---

## Test Commands

```bash
# Check ALB health
curl http://wastehunter-alb-531314747.us-west-2.elb.amazonaws.com/health

# Backend health
curl http://localhost:8000/api/health

# Get all findings
curl http://localhost:8000/api/findings | python3 -m json.tool

# Trigger Datadog scan
curl -X POST http://localhost:8000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"cpu_threshold_pct": 10.0, "lookback_minutes": 60}'

# Create PR for a finding
curl -X POST http://localhost:8000/api/create_pr/i-029da6afe1826bbba

# Approve PR
curl -X POST http://localhost:8000/api/approve/i-029da6afe1826bbba

# Reject PR
curl -X POST http://localhost:8000/api/reject/i-029da6afe1826bbba \
  -H "Content-Type: application/json" \
  -d '{"reason": "Not safe to downsize during peak traffic", "rejected_by": "engineer"}'

# Run standalone agent (full pipeline with mock data)
cd backend && .venv/bin/python -m agent.waste_hunter

# Run Datadog scanner CLI
cd backend && .venv/bin/python scanner/datadog_scanner.py

# Run MiniMax rewriter CLI
cd backend && .venv/bin/python github_pr/minimax_rewriter.py
```

---

## CopilotKit npm Dependencies

```json
"@copilotkit/react-core": "^1.51.4",
"@copilotkit/react-ui": "^1.51.4",
"@copilotkit/runtime": "^1.51.4"
```

Installed with `--legacy-peer-deps` due to `@anthropic-ai/sdk` version conflict (`@copilotkit/runtime` expects `^0.57.0` but `0.78.0` is installed — works at runtime).

---

## Python Dependencies (backend/requirements.txt)

```
mcp>=1.0.0                  # Model Context Protocol (FastMCP)
anthropic[bedrock]>=0.40.0  # Bedrock + Anthropic SDK
boto3>=1.34.0               # AWS SDK (EC2, Bedrock)
neo4j>=5.20.0               # Neo4j Aura driver
httpx>=0.27.0               # MiniMax REST API calls
PyGithub>=2.3.0             # GitHub PR creation
fastapi>=0.115.0            # REST API
uvicorn[standard]>=0.30.0   # ASGI server
python-dotenv>=1.0.0        # .env loading
pydantic>=2.7.0             # Request/response models
requests>=2.31.0            # Datadog API calls (scanner)
```

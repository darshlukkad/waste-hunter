# FinOps Waste Hunter — Full Project Context

> **Hackathon**: AWS × Anthropic × Datadog GenAI Hackathon
> **Goal**: Autonomous agentic workflow that finds structural cloud waste, validates safety via a Neo4j knowledge graph, rewrites IaC with MiniMax AI, opens GitHub PRs, and lets engineers approve/reject via a CopilotKit-powered human-in-the-loop UI.

---

## Repository Structure

```
WasteHunter/
├── backend/
│   ├── .env                        # All secrets (see below)
│   ├── requirements.txt
│   ├── .venv/                      # Python 3.13 venv (mcp needs ≥3.10)
│   ├── api/
│   │   └── server.py               # FastAPI REST API (port 8000)
│   ├── agent/
│   │   └── waste_hunter.py         # Amazon Bedrock agentic loop
│   ├── graph/                      # Neo4j integration (renamed from neo4j/ to avoid package shadow)
│   │   ├── blast_radius.py         # BlastRadiusChecker class
│   │   └── schema.cypher           # Seed data for Neo4j Aura
│   ├── github_pr/
│   │   ├── minimax_rewriter.py     # MiniMax IaC rewriter (Terraform + K8s)
│   │   └── pr_creator.py           # GitHub PR creator via PyGithub
│   └── mcp_server/
│       ├── server.py               # FastMCP server (5 tools)
│       └── mock_data.py            # Mock Datadog telemetry
├── frontend/
│   ├── .env.local                  # Frontend env vars
│   ├── package.json                # Next.js 16, React 19, CopilotKit 1.51.4
│   ├── app/
│   │   ├── layout.tsx              # Root layout with <Providers> + suppressHydrationWarning
│   │   ├── providers.tsx           # CopilotKit provider wrapper ("use client")
│   │   ├── page.tsx                # Dashboard — lists all triggers
│   │   ├── trigger/[id]/page.tsx   # Trigger detail — wraps agent findings in CopilotTriggerDetail
│   │   └── api/backend/[...path]/route.ts  # Next.js proxy → FastAPI backend
│   ├── components/
│   │   ├── approval-card.tsx       # Generative UI card for approve/reject
│   │   ├── copilot-trigger-detail.tsx  # CopilotKit sidebar + actions
│   │   ├── top-nav.tsx
│   │   ├── trigger-detail-header.tsx
│   │   ├── trigger-metrics.tsx
│   │   ├── state-timeline.tsx
│   │   ├── trigger-config.tsx
│   │   └── ui/                     # shadcn/ui components
│   └── lib/
│       └── data.ts                 # Trigger data + AgentFinding interface
└── infra/
    ├── terraform/main.tf           # Mock Terraform with m5.4xlarge (waste target)
    └── k8s/deployment.yaml         # Mock K8s with oversized resource requests
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI Orchestration | Amazon Bedrock — Claude Sonnet 4.5 cross-region inference |
| Bedrock Model ID | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` (us-west-2) |
| Tool Protocol | MCP (Model Context Protocol) via FastMCP |
| Telemetry | Datadog (mocked) via MCP tool |
| Dependency Graph | Neo4j Aura — blast radius assessment + rejection memory |
| IaC Rewriting | MiniMax `MiniMax-Text-01` via `https://api.minimax.io/v1` |
| PR Automation | GitHub via PyGithub |
| Backend API | FastAPI + uvicorn (port 8000) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| AI Chat UI | CopilotKit 1.51.4 — self-hosted runtime via `/api/copilotkit` + `AnthropicAdapter` |
| Styling | Tailwind CSS v4, shadcn/ui |
| Charts | Recharts |
| Hosting (demo) | localhost (frontend :3000, backend :8000) |

---

## Environment Variables

### `backend/.env`
```
NEO4J_URI=neo4j+s://ef15a093.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<secret>

MINIMAX_API_KEY=sk-api-<secret>
MINIMAX_GROUP_ID=2024721252354101384

GITHUB_TOKEN=github_pat_<secret>
GITHUB_REPO=darshlukkad/waste-hunter-dummy

COPILOTKIT_API_KEY=ck_pub_4d2973a359584f58bccc6cd5e7117324

# AWS via ~/.aws/credentials — region: us-west-2
```

### `frontend/.env.local`
```
NEXT_PUBLIC_COPILOTKIT_API_KEY=ck_pub_4d2973a359584f58bccc6cd5e7117324
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
ANTHROPIC_API_KEY=<your-anthropic-api-key>   # Required for CopilotKit self-hosted runtime
```

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

- Dashboard: http://localhost:3000
- Agent finding detail: http://localhost:3000/trigger/i-0a1b2c3d4e5f67890
- Backend health: http://localhost:8000/api/health
- Backend findings: http://localhost:8000/api/findings

---

## Agent Pipeline (5 Steps)

```
1. get_idle_resources        → Datadog scan → finds i-0a1b2c3d4e5f67890 (m5.4xlarge, $413/mo waste)
2. get_resource_telemetry    → 7-day hourly metrics: CPU 3.2% avg, memory 14.7%
3. check_blast_radius        → Neo4j graph traversal → CRITICAL (RDS + ALB dependencies, prior rejection)
4. rewrite_iac               → MiniMax rewrites main.tf + deployment.yaml (m5.4xlarge → m5.xlarge)
5. create_github_pr          → Opens draft PR on darshlukkad/waste-hunter-dummy (CRITICAL = draft)
```

Run the agent:
```bash
cd backend
.venv/bin/python -m agent.waste_hunter
```

---

## Backend API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/findings` | All agent findings with current PR status |
| GET | `/api/findings/{resource_id}` | Single finding |
| POST | `/api/approve/{resource_id}` | Merge GitHub PR via PyGithub, updates in-memory status |
| POST | `/api/reject/{resource_id}` | Close PR + write RejectedAction node to Neo4j |

The reject body is `{ "reason": "string", "rejected_by": "string" }`.

In-memory state (`FINDINGS`, `PR_STATUS`) is seeded with the real agent output for `prod-api-server-03`.

---

## Frontend Data Flow

```
lib/data.ts
  └── Trigger interface (+ optional AgentFinding)
  └── triggers[] array — includes prod-api-server-03 (id: i-0a1b2c3d4e5f67890)

app/trigger/[id]/page.tsx
  └── if trigger.finding → wrap in <CopilotTriggerDetail>

components/copilot-trigger-detail.tsx
  └── useCopilotReadable → gives AI context about resource
  └── useCopilotAction("approve_downsize_pr") → renders <ApprovalCard>, calls /api/backend/approve/{id}
  └── useCopilotAction("reject_downsize_pr")  → renders <ApprovalCard>, calls /api/backend/reject/{id}
  └── CopilotSidebar → defaultOpen=true when PR exists, pre-loaded initial message

app/api/backend/[...path]/route.ts
  └── Proxies /api/backend/** → http://localhost:8000/api/**

app/api/copilotkit/route.ts
  └── Self-hosted CopilotKit runtime (POST) using AnthropicAdapter + claude-sonnet-4-6-20251101
  └── Eliminates "useAgent: Agent 'default' not found" cloud error

app/providers.tsx
  └── <CopilotKit runtimeUrl="/api/copilotkit"> wraps entire app
```

---

## Key Decisions & Bug Fixes

### Python
- **Python 3.13 required**: `mcp` package needs ≥3.10; used `/opt/homebrew/bin/python3.13`
- **`graph/` not `neo4j/`**: Directory named `neo4j/` shadowed the installed `neo4j` pip package → renamed to `graph/`
- **Cypher hop range**: `[r*1..$max_hops]` fails in Neo4j (parameters can't be range bounds) → use f-string: `f"[r*1..{hops}]"`
- **Neo4j seed**: Comment filter was applied to entire chunks → strip comment lines per chunk
- **MiniMax endpoint**: Correct URL is `https://api.minimax.io/v1/chat/completions` (not `minimaxi.com` or `minimax.chat`)
- **Bedrock model**: Must use `us.` prefix for cross-region inference + `:0` suffix. Model only approved in `us-west-2`
- **PR imports**: `from github_pr.minimax_rewriter import ...` (not relative) when called from agent

### Frontend
- **Hydration warning**: Grammarly browser extension injects `data-gr-ext-installed` on `<body>` → fixed with `suppressHydrationWarning` on `<body>` in layout.tsx
- **CopilotKit "useAgent not found"**: `publicApiKey` cloud mode requires agents registered in CopilotKit cloud — not needed here. Fixed by switching to self-hosted runtime: created `app/api/copilotkit/route.ts` using `AnthropicAdapter`, updated `providers.tsx` to `runtimeUrl="/api/copilotkit"`, requires `ANTHROPIC_API_KEY` in `.env.local`
- **CopilotKit blast_risk type**: `ApprovalCard` expects `"SAFE" | "LOW" | "MEDIUM" | "CRITICAL"` union → cast with `as` in copilot-trigger-detail.tsx
- **Unused BACKEND var**: Removed from copilot-trigger-detail.tsx

---

## Real Agent Finding (Demo Data)

```
Resource:       prod-api-server-03  (i-0a1b2c3d4e5f67890)
Service:        Recommendation Engine
Region:         us-east-1
Current type:   m5.4xlarge  ($551/mo)
Recommended:    m5.xlarge   ($138/mo)
Savings:        $413/mo  ($4,956/yr)
CPU avg:        3.2%  (p95: 8.1%)
Memory avg:     14.7%
Blast risk:     CRITICAL
  - RDS 'recommendation-db' (HIGH criticality, 1 hop)
  - LoadBalancer 'prod-api-alb' (HIGH criticality, 1 hop)
  - Prior rejection: alice@company.com — "Black Friday traffic spike"
PR:             https://github.com/darshlukkad/waste-hunter-dummy/pull/1 (draft)
Confidence:     HIGH
```

---

## CopilotKit Integration

The sidebar auto-opens on the trigger detail page for `prod-api-server-03` with a pre-written message summarising the finding. The AI understands two actions:

- **"approve"** → calls `approve_downsize_pr` → renders ApprovalCard → POST `/api/backend/approve/i-0a1b2c3d4e5f67890` → merges PR via GitHub API
- **"reject because <reason>"** → calls `reject_downsize_pr` → renders ApprovalCard → POST `/api/backend/reject/i-0a1b2c3d4e5f67890` → closes PR + writes `RejectedAction` node to Neo4j so the agent remembers the decision

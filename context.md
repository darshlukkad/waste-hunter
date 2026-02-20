# FinOps Waste Hunter — Full Project Context

> **Hackathon**: AWS × Anthropic × Datadog GenAI Hackathon
> **Goal**: Autonomous agentic workflow that finds structural cloud waste, validates safety via a Neo4j knowledge graph, rewrites IaC with MiniMax AI, opens GitHub PRs, and lets engineers approve/reject via a CopilotKit-powered human-in-the-loop UI.

---

## Current Status (as of Feb 2025)

### ✅ Completed
| Phase | What's Done |
|---|---|
| **Phase 1 — Core Agent** | FastAPI backend, Bedrock agent loop, 5 MCP tools, Neo4j blast radius, MiniMax IaC rewriter, GitHub PR creator |
| **Phase 2 — Frontend** | Next.js dashboard, trigger detail page, CopilotKit self-hosted runtime, approve/reject UI with generative cards |
| **Phase 3 — Real AWS Infra** | `waste-hunter-dummy` repo deployed: 3× t3.micro EC2 instances (ASG min=3, max=6), ALB, CloudWatch alarms, Datadog agent on each instance |

### 🔴 Pending (Next Steps)
| # | Task | Details |
|---|---|---|
| 1 | **Wire real instance ID** | Replace mock `i-0a1b2c3d4e5f67890` with real `i-0745704ce945b62bc` in `backend/api/server.py` |
| 2 | **Verify Datadog metrics** | Check Datadog → Infrastructure → Hosts for 3 hosts tagged `WasteHunter:monitor` |
| 3 | **Replace mock Datadog data** | Update `backend/mcp_server/mock_data.py` to call real Datadog API using `DATADOG_API_KEY` + `DATADOG_APP_KEY` |
| 4 | **End-to-end demo run** | Trigger agent against real instance → opens real PR on waste-hunter-dummy → approve in UI |
| 5 | **Add ANTHROPIC_API_KEY** | Fill in `frontend/.env.local` — required for CopilotKit self-hosted runtime |

---

## Real AWS Infrastructure (waste-hunter-dummy repo)

```
Account:    318265007132 (personal, us-west-2)
Region:     us-west-2
ALB DNS:    wastehunter-alb-531314747.us-west-2.elb.amazonaws.com
ASG:        wastehunter-asg  (min=3, desired=3, max=6)
Instance:   i-0745704ce945b62bc  (t3.micro, AL2023)
Instance type: t3.micro  ← WasteHunter will recommend → t3.nano
VPC:        vpc-0c3b19d3a75cd8d1a (default VPC)
Subnets:    subnet-074fb1e09376f5048, subnet-0fa64fc77257dc15d
```

### Scale logic
- Scale **out** (up to 6): CPU > 70% for 2× 60s periods
- Scale **in** (down to 3): CPU < 10% for 5× 120s periods

### Test commands
```bash
curl http://wastehunter-alb-531314747.us-west-2.elb.amazonaws.com/health
# → {"status": "ok"}

curl http://wastehunter-alb-531314747.us-west-2.elb.amazonaws.com/api/recommend
# → 5 random recommendations (simulates idle rec-engine)

# Get running instance IDs
aws ec2 describe-instances \
  --filters "Name=tag:WasteHunter,Values=monitor" "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].InstanceId' \
  --output text --region us-west-2
```

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
│       └── mock_data.py            # Mock Datadog telemetry (replace with real Datadog API)
├── frontend/
│   ├── .env.local                  # Frontend env vars
│   ├── package.json                # Next.js 16, React 19, CopilotKit 1.51.4
│   ├── app/
│   │   ├── layout.tsx              # Root layout with <Providers> + suppressHydrationWarning
│   │   ├── providers.tsx           # CopilotKit provider wrapper ("use client")
│   │   ├── page.tsx                # Dashboard — lists all triggers
│   │   ├── trigger/[id]/page.tsx   # Trigger detail — wraps agent findings in CopilotTriggerDetail
│   │   ├── api/backend/[...path]/route.ts  # Next.js proxy → FastAPI backend
│   │   └── api/copilotkit/route.ts # Self-hosted CopilotKit runtime (AnthropicAdapter)
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
├── infra/
│   ├── terraform/main.tf           # Mock Terraform with m5.4xlarge (waste target for demo)
│   └── k8s/deployment.yaml         # Mock K8s with oversized resource requests
└── context.md                      # This file
```

**Separate repo** — `darshlukkad/waste-hunter-dummy`:
```
waste-hunter-dummy/
├── infra/terraform/
│   ├── main.tf          # Real deployable Terraform (ALB + ASG + EC2)
│   ├── variables.tf     # vpc_id, subnet_ids, ami_id, instance_type, datadog_api_key
│   ├── outputs.tf       # alb_dns, asg_name, get_instance_ids command
│   ├── user_data.sh     # EC2 bootstrap: installs rec_engine.py + Datadog agent
│   └── terraform.tfvars # Local only — contains secrets, gitignored
└── app/
    └── rec_engine.py    # Minimal idle HTTP server (stdlib only, port 8080)
                         # GET /health → {"status":"ok"}
                         # GET /api/recommend → 5 random items
                         # GET /metrics → uptime + request count
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI Orchestration | Amazon Bedrock — Claude Sonnet 4.5 cross-region inference |
| Bedrock Model ID | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` (us-west-2) |
| Tool Protocol | MCP (Model Context Protocol) via FastMCP |
| Telemetry | Datadog (mock → real) via MCP tool |
| Dependency Graph | Neo4j Aura — blast radius assessment + rejection memory |
| IaC Rewriting | MiniMax `MiniMax-Text-01` via `https://api.minimax.io/v1` |
| PR Automation | GitHub via PyGithub |
| Backend API | FastAPI + uvicorn (port 8000) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| AI Chat UI | CopilotKit 1.51.4 — self-hosted runtime via `/api/copilotkit` + `AnthropicAdapter` |
| Styling | Tailwind CSS v4, shadcn/ui |
| Charts | Recharts |
| Real Infra | AWS EC2 (t3.micro × 3), ALB, ASG, CloudWatch, Datadog agent |
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

# Datadog — add these for real metrics (optional, mock works for demo)
# DATADOG_API_KEY=888c9d32ae2a2c0ee7920983abab0515
# DATADOG_APP_KEY=<app_key>
# DATADOG_SITE=datadoghq.com

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
- Agent finding detail: http://localhost:3000/trigger/i-0745704ce945b62bc
- Backend health: http://localhost:8000/api/health
- Backend findings: http://localhost:8000/api/findings

---

## Agent Pipeline (5 Steps)

```
1. get_idle_resources        → Datadog scan → finds i-0745704ce945b62bc (t3.micro, ~$0.01/hr waste)
2. get_resource_telemetry    → 7-day hourly metrics: CPU ~2% avg, memory ~15%
3. check_blast_radius        → Neo4j graph traversal → blast risk assessment
4. rewrite_iac               → MiniMax rewrites main.tf (t3.micro → t3.nano)
5. create_github_pr          → Opens PR on darshlukkad/waste-hunter-dummy
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
  └── triggers[] array — includes prod-api-server-03 (id: i-0745704ce945b62bc)

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

### AWS / Terraform (waste-hunter-dummy)
- **Workshop account blocks**: ec2:DescribeImages, ssm:GetParameter, ec2:CreateVpc, iam:CreateRole, ec2:DescribeVpcAttribute — all blocked by WSParticipantRole
- **Personal account creds**: BedrockAPIKey-9upb only had Bedrock permissions — needed to add EC2FullAccess, IAMFullAccess, ELBFullAccess, AutoScalingFullAccess, CloudWatchFullAccess
- **AMI lookup blocked**: Use hardcoded `var.ami_id` instead of data sources
- **Free tier restriction**: t3.medium and t2.micro rejected — t3.micro works
- **No data sources**: All VPC/subnet/IAM lookups use hardcoded variables to avoid DescribeVpcAttribute etc.

---

## Demo Data (Current)

```
Resource:       prod-api-server-03  (i-0745704ce945b62bc)
Service:        Recommendation Engine
Region:         us-west-2
Current type:   t3.micro  (~$0.01/hr)
Recommended:    t3.nano   (~$0.005/hr, saves ~50%)
CPU avg:        ~2%  (idle rec-engine app)
Memory avg:     ~15%
ALB:            wastehunter-alb-531314747.us-west-2.elb.amazonaws.com
ASG:            wastehunter-asg (3 instances, scales to 6 at CPU>70%)
PR target:      darshlukkad/waste-hunter-dummy → infra/terraform/main.tf
```

---

## CopilotKit Integration

The sidebar auto-opens on the trigger detail page for `prod-api-server-03` with a pre-written message summarising the finding. The AI understands two actions:

- **"approve"** → calls `approve_downsize_pr` → renders ApprovalCard → POST `/api/backend/approve/i-0745704ce945b62bc` → merges PR via GitHub API
- **"reject because <reason>"** → calls `reject_downsize_pr` → renders ApprovalCard → POST `/api/backend/reject/i-0745704ce945b62bc` → closes PR + writes `RejectedAction` node to Neo4j so the agent remembers the decision

---

## Future Phases

### Phase 4 — Real Datadog Integration
- Replace `backend/mcp_server/mock_data.py` with live Datadog API calls
- Use `DATADOG_API_KEY` + `DATADOG_APP_KEY` in `.env`
- Query `aws.ec2.cpuutilization` for the real ASG instances
- Trigger WasteHunter automatically when CPU stays below 10% for 7 days

### Phase 5 — Multi-Resource Support
- Extend agent to scan all EC2 instances tagged `WasteHunter:monitor`
- Support RDS, ECS, Lambda waste detection
- Add K8s resource request waste (already has `infra/k8s/deployment.yaml`)
- Batch PR creation for multiple findings

### Phase 6 — Scheduled Scanning
- Add cron job / EventBridge rule to run agent daily
- Store findings history in DynamoDB or PostgreSQL
- Email/Slack alerts when new waste is detected

### Phase 7 — Production Hardening
- Replace in-memory `FINDINGS`/`PR_STATUS` with persistent DB
- Add authentication to frontend (Cognito / Auth0)
- Deploy backend to AWS Lambda or ECS Fargate
- Deploy frontend to Vercel or S3 + CloudFront
- Add Terraform state backend (S3 + DynamoDB lock)

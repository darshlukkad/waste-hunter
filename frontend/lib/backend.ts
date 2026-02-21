import type {
  Trigger,
  TriggerStatus,
  ReasoningStep,
  BlastRisk,
  CodeChange,
  WorkflowState,
  WorkflowStep,
} from "@/lib/data"

export interface BackendFinding {
  resource_id: string
  name: string
  service?: string
  team?: string
  owner?: string
  region?: string
  current_type: string
  recommended_type: string
  status?: string
  severity?: string
  confidence?: string
  idle_since?: string
  last_active?: string
  current_cost_usd?: number
  projected_cost_usd?: number
  monthly_savings_usd?: number
  annual_savings_usd?: number
  savings_pct?: number
  cpu_avg_pct?: number
  cpu_p95_pct?: number
  memory_avg_pct?: number
  memory_p95_pct?: number
  blast_risk?: BlastRisk
  blast_reasons?: string[]
  evidence?: string[]
  action?: string
  pr_url?: string | null
  pr_number?: number
  pr_is_draft?: boolean
  pr_status?: "open" | "merged" | "closed"
  pr_branch?: string
  files_changed?: string[]
  scanned_at?: string
}

export interface BackendFindingsResponse {
  findings: BackendFinding[]
  count: number
}

export interface BackendActionResponse {
  status: string
  pr_url?: string
  pr_number?: number
  sha?: string
  reason?: string
  message?: string
}

const DEFAULT_BACKEND_URL = "http://localhost:8000"

export function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = getBackendBaseUrl()
  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function fetchFindings(): Promise<BackendFinding[]> {
  const payload = await fetchJson<BackendFindingsResponse>("/api/findings")
  return payload.findings
}

export async function fetchFinding(resourceId: string): Promise<BackendFinding | null> {
  const baseUrl = getBackendBaseUrl()
  const response = await fetch(`${baseUrl}/api/findings/${resourceId}`, {
    cache: "no-store",
  })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(detail || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<BackendFinding>
}

export interface ScanResponse {
  status: string
  scanned_at: string
  cpu_threshold_pct: number
  lookback_minutes: number
  total_idle: number
  new_findings: number
  updated_findings: number
  findings: BackendFinding[]
}

export async function triggerScan(
  cpuThreshold = 10.0,
  lookbackMinutes = 60
): Promise<ScanResponse> {
  return fetchJson<ScanResponse>("/api/scan", {
    method: "POST",
    body: JSON.stringify({
      cpu_threshold_pct: cpuThreshold,
      lookback_minutes: lookbackMinutes,
    }),
  })
}

export async function createPr(resourceId: string): Promise<BackendActionResponse> {
  return fetchJson<BackendActionResponse>(`/api/create_pr/${resourceId}`, {
    method: "POST",
  })
}

export interface PrProgress {
  step: "idle" | "queued" | "seeding" | "reading" | "rewriting" | "committing" | "done" | "error"
  done: boolean
  error: string | null
  pr_url?: string
  pr_number?: number
}

export async function getPrProgress(resourceId: string): Promise<PrProgress> {
  return fetchJson<PrProgress>(`/api/pr_progress/${resourceId}`)
}

export async function approveFinding(resourceId: string): Promise<BackendActionResponse> {
  return fetchJson<BackendActionResponse>(`/api/approve/${resourceId}`, {
    method: "POST",
  })
}

export async function rejectFinding(
  resourceId: string,
  reason: string,
  rejectedBy = "copilot-ui"
): Promise<BackendActionResponse> {
  return fetchJson<BackendActionResponse>(`/api/reject/${resourceId}`, {
    method: "POST",
    body: JSON.stringify({ reason, rejected_by: rejectedBy }),
  })
}

function resolveTriggerStatus(finding: BackendFinding): TriggerStatus {
  if (finding.pr_status === "merged") return "approved"
  if (finding.pr_status === "closed") return "rejected"
  if (finding.pr_url) return "pr_ready"
  if (finding.status === "analyzing") return "analyzing"
  return "detected"
}

function buildReasoningSteps(finding: BackendFinding): ReasoningStep[] {
  const steps: ReasoningStep[] = []
  const evidence = finding.evidence?.filter(Boolean) || []
  if (evidence.length > 0) {
    steps.push({
      title: "Telemetry evidence",
      detail: evidence.join(" "),
    })
  }
  const blast = finding.blast_reasons?.filter(Boolean) || []
  if (blast.length > 0) {
    steps.push({
      title: "Blast radius check",
      detail: blast.join(" "),
    })
  } else if (finding.blast_risk) {
    steps.push({
      title: "Blast radius check",
      detail: `Risk level assessed as ${finding.blast_risk}.`,
    })
  }
  steps.push({
    title: "Recommendation",
    detail: `Downsize from ${finding.current_type} to ${finding.recommended_type} to capture projected savings.`,
  })
  return steps
}

function buildCopilotSummary(finding: BackendFinding): string {
  const monthly = finding.monthly_savings_usd ?? 0
  const risk = finding.blast_risk || "MEDIUM"
  return `${finding.name} appears idle. Recommended downsize from ${finding.current_type} to ${finding.recommended_type} saves ~$${monthly}/mo. Blast risk is ${risk}.`
}

function buildWorkflow(finding: BackendFinding): WorkflowState {
  const prStatus = finding.pr_status
  const prCreated = Boolean(finding.pr_url)
  const approvalStatus: WorkflowStep["status"] = prStatus === "merged"
    ? "complete"
    : prStatus === "closed"
      ? "failed"
      : prStatus === "open"
        ? "active"
        : "pending"

  const steps: WorkflowStep[] = [
    {
      id: "scan",
      label: "Idle scan",
      status: "complete",
      detail: finding.scanned_at ? `Scanned ${finding.scanned_at}` : undefined,
    },
    {
      id: "blast",
      label: "Blast radius",
      status: finding.blast_risk ? "complete" : "pending",
      detail: finding.blast_risk ? `Risk ${finding.blast_risk}` : undefined,
    },
    {
      id: "rewrite",
      label: "IaC rewrite",
      status: prCreated ? "complete" : "active",
      detail: finding.action ? `Action ${finding.action}` : undefined,
    },
    {
      id: "pr",
      label: "PR created",
      status: prCreated ? "complete" : "pending",
      detail: finding.pr_url ? "PR is available" : "Waiting on PR",
    },
    {
      id: "approval",
      label: "Approval",
      status: approvalStatus,
      detail:
        prStatus === "merged"
          ? "Merged"
          : prStatus === "closed"
            ? "Closed"
            : prStatus === "open"
              ? "Awaiting review"
              : "Pending",
    },
  ]

  const label =
    prStatus === "merged"
      ? "Approved"
      : prStatus === "closed"
        ? "Rejected"
        : prCreated
          ? "Awaiting approval"
          : "Preparing PR"

  const status: WorkflowState["status"] =
    prStatus === "merged"
      ? "approved"
      : prStatus === "closed"
        ? "rejected"
        : prCreated
          ? "waiting"
          : "running"

  return {
    label,
    status,
    steps,
    lastUpdated: finding.scanned_at || finding.idle_since,
  }
}

export function mapFindingToTrigger(finding: BackendFinding): Trigger {
  const monthly = finding.monthly_savings_usd ?? 0
  const yearly = finding.annual_savings_usd ?? monthly * 12
  const prTitle = `chore: downsize ${finding.name} from ${finding.current_type} to ${finding.recommended_type}`

  const trigger: Trigger = {
    id: finding.resource_id,
    resourceName: finding.name,
    resourceId: finding.resource_id,
    service: finding.service || "EC2",
    region: finding.region || "unknown",
    currentInstance: finding.current_type,
    recommendedInstance: finding.recommended_type,
    monthlySavings: Math.round(monthly),
    yearlySavings: Math.round(yearly),
    blastRisk: (finding.blast_risk || "MEDIUM") as BlastRisk,
    status: resolveTriggerStatus(finding),
    detectedAt: finding.scanned_at || finding.idle_since || new Date().toISOString(),
    aiReasoning: buildReasoningSteps(finding),
    codeChanges: [] as CodeChange[],
    prUrl: finding.pr_url || null,
    prTitle,
    copilotSummary: buildCopilotSummary(finding),
    prStatus: finding.pr_status,
    workflow: buildWorkflow(finding),
    action: finding.action,
    cpuAvgPct: finding.cpu_avg_pct,
    cpuP95Pct: finding.cpu_p95_pct,
    memoryAvgPct: finding.memory_avg_pct,
    memoryP95Pct: finding.memory_p95_pct,
    currentCostUsd: finding.current_cost_usd,
    projectedCostUsd: finding.projected_cost_usd,
    savingsPct: finding.savings_pct,
  }

  return trigger
}

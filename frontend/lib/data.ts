export type TriggerStatus = "active" | "idle" | "downsized" | "paused"
export type TriggerSeverity = "low" | "medium" | "high" | "critical"

export interface Trigger {
  id: string
  name: string
  service: string
  region: string
  status: TriggerStatus
  severity: TriggerSeverity
  idleSince: string
  currentCost: number
  projectedCost: number
  savings: number
  cpu: number
  memory: number
  requests: number
  lastActive: string
  stateHistory: StateEvent[]
  metrics: MetricPoint[]
  config: TriggerConfig
}

export interface StateEvent {
  id: string
  timestamp: string
  fromState: TriggerStatus
  toState: TriggerStatus
  reason: string
  actor: string
}

export interface MetricPoint {
  time: string
  cpu: number
  memory: number
  requests: number
  cost: number
}

export interface TriggerConfig {
  idleThreshold: number // minutes
  cooldownPeriod: number // minutes
  minInstances: number
  maxInstances: number
  scaleDownPercent: number
  autoDownsize: boolean
}

export interface CostSummary {
  totalMonthlyCost: number
  totalSavings: number
  savingsPercent: number
  activeServices: number
  idleServices: number
  downsizedServices: number
  monthlyCostTrend: { month: string; cost: number; savings: number }[]
}

function generateMetrics(hours: number): MetricPoint[] {
  const metrics: MetricPoint[] = []
  const now = new Date()
  for (let i = hours; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000)
    const decay = Math.max(0.05, 1 - (hours - i) / hours)
    metrics.push({
      time: time.toISOString(),
      cpu: Math.round(Math.random() * 30 * decay + 2),
      memory: Math.round(Math.random() * 20 * decay + 10),
      requests: Math.round(Math.random() * 100 * decay),
      cost: +(Math.random() * 2 * decay + 0.1).toFixed(2),
    })
  }
  return metrics
}

export const triggers: Trigger[] = [
  {
    id: "trg-001",
    name: "auth-service-prod",
    service: "Authentication API",
    region: "us-east-1",
    status: "idle",
    severity: "high",
    idleSince: "2026-02-18T03:00:00Z",
    currentCost: 284.5,
    projectedCost: 42.0,
    savings: 242.5,
    cpu: 3,
    memory: 12,
    requests: 0,
    lastActive: "2026-02-18T02:47:00Z",
    stateHistory: [
      { id: "se-1", timestamp: "2026-02-18T03:00:00Z", fromState: "active", toState: "idle", reason: "No requests for 60 minutes", actor: "system" },
      { id: "se-2", timestamp: "2026-02-17T14:00:00Z", fromState: "idle", toState: "active", reason: "Traffic spike detected", actor: "system" },
      { id: "se-3", timestamp: "2026-02-17T08:00:00Z", fromState: "active", toState: "idle", reason: "No requests for 60 minutes", actor: "system" },
    ],
    metrics: generateMetrics(48),
    config: { idleThreshold: 60, cooldownPeriod: 15, minInstances: 1, maxInstances: 8, scaleDownPercent: 75, autoDownsize: true },
  },
  {
    id: "trg-002",
    name: "payment-gateway",
    service: "Payment Processing",
    region: "eu-west-1",
    status: "idle",
    severity: "critical",
    idleSince: "2026-02-19T18:00:00Z",
    currentCost: 512.0,
    projectedCost: 64.0,
    savings: 448.0,
    cpu: 1,
    memory: 8,
    requests: 0,
    lastActive: "2026-02-19T17:32:00Z",
    stateHistory: [
      { id: "se-4", timestamp: "2026-02-19T18:00:00Z", fromState: "active", toState: "idle", reason: "No requests for 30 minutes", actor: "system" },
      { id: "se-5", timestamp: "2026-02-19T12:00:00Z", fromState: "downsized", toState: "active", reason: "Manual scale up", actor: "admin@company.com" },
    ],
    metrics: generateMetrics(24),
    config: { idleThreshold: 30, cooldownPeriod: 10, minInstances: 2, maxInstances: 12, scaleDownPercent: 80, autoDownsize: false },
  },
  {
    id: "trg-003",
    name: "analytics-engine",
    service: "Data Analytics",
    region: "us-west-2",
    status: "downsized",
    severity: "medium",
    idleSince: "2026-02-16T10:00:00Z",
    currentCost: 156.0,
    projectedCost: 23.0,
    savings: 133.0,
    cpu: 5,
    memory: 18,
    requests: 12,
    lastActive: "2026-02-16T09:45:00Z",
    stateHistory: [
      { id: "se-6", timestamp: "2026-02-17T10:00:00Z", fromState: "idle", toState: "downsized", reason: "Auto-downsize after 24h idle", actor: "system" },
      { id: "se-7", timestamp: "2026-02-16T10:00:00Z", fromState: "active", toState: "idle", reason: "No requests for 60 minutes", actor: "system" },
    ],
    metrics: generateMetrics(72),
    config: { idleThreshold: 60, cooldownPeriod: 30, minInstances: 1, maxInstances: 6, scaleDownPercent: 60, autoDownsize: true },
  },
  {
    id: "trg-004",
    name: "notification-svc",
    service: "Push Notifications",
    region: "ap-southeast-1",
    status: "active",
    severity: "low",
    idleSince: "",
    currentCost: 89.0,
    projectedCost: 89.0,
    savings: 0,
    cpu: 45,
    memory: 62,
    requests: 1240,
    lastActive: "2026-02-20T14:30:00Z",
    stateHistory: [
      { id: "se-8", timestamp: "2026-02-20T08:00:00Z", fromState: "idle", toState: "active", reason: "Morning traffic surge", actor: "system" },
    ],
    metrics: generateMetrics(12),
    config: { idleThreshold: 120, cooldownPeriod: 20, minInstances: 1, maxInstances: 4, scaleDownPercent: 50, autoDownsize: true },
  },
  {
    id: "trg-005",
    name: "image-processor",
    service: "Media Pipeline",
    region: "us-east-1",
    status: "idle",
    severity: "high",
    idleSince: "2026-02-19T06:00:00Z",
    currentCost: 340.0,
    projectedCost: 51.0,
    savings: 289.0,
    cpu: 2,
    memory: 9,
    requests: 0,
    lastActive: "2026-02-19T05:12:00Z",
    stateHistory: [
      { id: "se-9", timestamp: "2026-02-19T06:00:00Z", fromState: "active", toState: "idle", reason: "No requests for 60 minutes", actor: "system" },
      { id: "se-10", timestamp: "2026-02-18T22:00:00Z", fromState: "downsized", toState: "active", reason: "Batch job triggered", actor: "cron-scheduler" },
      { id: "se-11", timestamp: "2026-02-18T16:00:00Z", fromState: "idle", toState: "downsized", reason: "Auto-downsize after 8h idle", actor: "system" },
    ],
    metrics: generateMetrics(36),
    config: { idleThreshold: 60, cooldownPeriod: 15, minInstances: 0, maxInstances: 10, scaleDownPercent: 90, autoDownsize: true },
  },
  {
    id: "trg-006",
    name: "search-indexer",
    service: "Search Service",
    region: "eu-central-1",
    status: "paused",
    severity: "low",
    idleSince: "2026-02-14T00:00:00Z",
    currentCost: 72.0,
    projectedCost: 0,
    savings: 72.0,
    cpu: 0,
    memory: 0,
    requests: 0,
    lastActive: "2026-02-13T23:15:00Z",
    stateHistory: [
      { id: "se-12", timestamp: "2026-02-15T00:00:00Z", fromState: "downsized", toState: "paused", reason: "7-day idle policy", actor: "system" },
      { id: "se-13", timestamp: "2026-02-14T00:00:00Z", fromState: "idle", toState: "downsized", reason: "Auto-downsize after 24h idle", actor: "system" },
    ],
    metrics: generateMetrics(24),
    config: { idleThreshold: 120, cooldownPeriod: 60, minInstances: 0, maxInstances: 3, scaleDownPercent: 100, autoDownsize: true },
  },
  {
    id: "trg-007",
    name: "email-dispatcher",
    service: "Email Service",
    region: "us-east-1",
    status: "active",
    severity: "low",
    idleSince: "",
    currentCost: 124.0,
    projectedCost: 124.0,
    savings: 0,
    cpu: 35,
    memory: 48,
    requests: 890,
    lastActive: "2026-02-20T14:28:00Z",
    stateHistory: [
      { id: "se-14", timestamp: "2026-02-20T06:00:00Z", fromState: "idle", toState: "active", reason: "Scheduled email batch", actor: "cron-scheduler" },
    ],
    metrics: generateMetrics(12),
    config: { idleThreshold: 90, cooldownPeriod: 15, minInstances: 1, maxInstances: 5, scaleDownPercent: 60, autoDownsize: false },
  },
  {
    id: "trg-008",
    name: "ml-inference",
    service: "ML Inference API",
    region: "us-west-2",
    status: "idle",
    severity: "critical",
    idleSince: "2026-02-19T22:00:00Z",
    currentCost: 890.0,
    projectedCost: 89.0,
    savings: 801.0,
    cpu: 4,
    memory: 15,
    requests: 0,
    lastActive: "2026-02-19T21:38:00Z",
    stateHistory: [
      { id: "se-15", timestamp: "2026-02-19T22:00:00Z", fromState: "active", toState: "idle", reason: "No requests for 30 minutes", actor: "system" },
    ],
    metrics: generateMetrics(18),
    config: { idleThreshold: 30, cooldownPeriod: 5, minInstances: 1, maxInstances: 20, scaleDownPercent: 85, autoDownsize: true },
  },
]

export const costSummary: CostSummary = {
  totalMonthlyCost: 2467.5,
  totalSavings: 1985.5,
  savingsPercent: 80.5,
  activeServices: 2,
  idleServices: 4,
  downsizedServices: 2,
  monthlyCostTrend: [
    { month: "Sep", cost: 4200, savings: 800 },
    { month: "Oct", cost: 3900, savings: 1200 },
    { month: "Nov", cost: 3600, savings: 1500 },
    { month: "Dec", cost: 3100, savings: 1800 },
    { month: "Jan", cost: 2800, savings: 1950 },
    { month: "Feb", cost: 2467, savings: 1985 },
  ],
}

export function getTriggerById(id: string): Trigger | undefined {
  return triggers.find((t) => t.id === id)
}

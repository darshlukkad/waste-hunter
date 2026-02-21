"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  TrendingDown,
  DollarSign,
  CheckCircle2,
  Clock,
} from "lucide-react"
import {
  ComposedChart,
  Bar,
  BarChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useFindings } from "@/hooks/use-findings"
import { buildSavingsOverview } from "@/lib/overview"

// ── Blast risk colours (CSS vars) ─────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  SAFE:     "var(--chart-1)",
  LOW:      "var(--chart-2)",
  MEDIUM:   "var(--chart-3)",
  CRITICAL: "var(--destructive)",
}

export function AnalyticsSection() {
  const { data: triggers, loading, error } = useFindings()
  const overview = buildSavingsOverview(triggers)

  // ── Derived datasets ─────────────────────────────────────────────────────
  // Savings by service
  const savingsByService = Object.entries(
    triggers.reduce<Record<string, number>>((acc, t) => {
      acc[t.service] = (acc[t.service] ?? 0) + t.monthlySavings
      return acc
    }, {})
  ).map(([service, savings]) => ({ service, savings }))

  // Blast risk distribution
  const riskCounts = triggers.reduce<Record<string, number>>((acc, t) => {
    acc[t.blastRisk] = (acc[t.blastRisk] ?? 0) + 1
    return acc
  }, {})
  const riskData = Object.entries(riskCounts).map(([name, value]) => ({ name, value }))

  // CPU avg per resource (top 6 for readability)
  const cpuData = triggers
    .filter((t) => t.cpuAvgPct !== undefined)
    .slice(0, 6)
    .map((t) => ({
      name: t.resourceName.length > 18 ? t.resourceName.slice(0, 17) + "…" : t.resourceName,
      avg: +(t.cpuAvgPct ?? 0).toFixed(1),
      p95: +(t.cpuP95Pct ?? 0).toFixed(1),
    }))

  // ── Stat cards ──────────────────────────────────────────────────────────
  const statCards = [
    {
      label: "Monthly Savings",
      value: `$${overview.totalMonthlySavings.toLocaleString()}`,
      sub: `$${overview.totalYearlySavings.toLocaleString()}/yr projected`,
      icon: DollarSign,
      iconClass: "text-chart-1 bg-chart-1/10",
    },
    {
      label: "Total Findings",
      value: overview.totalFindings.toString(),
      sub: "resources analyzed",
      icon: TrendingDown,
      iconClass: "text-chart-2 bg-chart-2/10",
    },
    {
      label: "Approved",
      value: overview.approvedCount.toString(),
      sub: "downsizes completed",
      icon: CheckCircle2,
      iconClass: "text-chart-1 bg-chart-1/10",
    },
    {
      label: "Pending Review",
      value: overview.pendingCount.toString(),
      sub: "awaiting decision",
      icon: Clock,
      iconClass: "text-chart-3 bg-chart-3/10",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          Failed to load analytics: {error}
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border bg-card">
            <CardContent className="flex items-start gap-3 p-4">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.iconClass}`}>
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold tracking-tight text-foreground">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Row 1: Findings & savings over time  ─────────────────────────── */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Findings &amp; Savings by Month</h3>
              <p className="text-xs text-muted-foreground">Detected vs approved findings with cumulative monthly savings</p>
            </div>
            {loading && <span className="text-xs text-muted-foreground">Updating…</span>}
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={overview.savingsHistory} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="count" orientation="left" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <YAxis yAxisId="savings" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} width={44} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--foreground)" }}
                  formatter={(value: number, name: string) => {
                    if (name === "savings") return [`$${value.toLocaleString()}`, "Savings"]
                    if (name === "detected") return [value, "Detected"]
                    if (name === "approved") return [value, "Approved"]
                    return [value, name]
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} formatter={(v) => v === "detected" ? "Detected" : v === "approved" ? "Approved" : "Savings ($)"} />
                <Bar yAxisId="count" dataKey="detected" fill="var(--chart-2)" fillOpacity={0.35} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Bar yAxisId="count" dataKey="approved" fill="var(--chart-1)" fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={28} />
                <Line yAxisId="savings" type="monotone" dataKey="savings" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3, fill: "var(--chart-3)" }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Row 2: Savings by service  +  Blast risk donut ───────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Savings by service */}
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Savings by Service</h3>
            <p className="text-xs text-muted-foreground mb-4">Monthly savings opportunity per AWS service</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={savingsByService.length ? savingsByService : [{ service: "—", savings: 0 }]}
                  layout="vertical"
                  margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="service"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--foreground)" }}
                    formatter={(v: number) => [`$${v.toLocaleString()}/mo`, "Savings"]}
                  />
                  <Bar dataKey="savings" fill="var(--chart-1)" fillOpacity={0.85} radius={[0, 3, 3, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Blast risk distribution */}
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Blast Risk Distribution</h3>
            <p className="text-xs text-muted-foreground mb-4">Risk profile across all active findings</p>
            <div className="h-44 flex items-center justify-center">
              {riskData.length === 0 ? (
                <p className="text-xs text-muted-foreground">No findings yet</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, value }) => `${name} (${value})`}
                      labelLine={false}
                    >
                      {riskData.map((entry) => (
                        <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? "var(--muted-foreground)"} fillOpacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--foreground)" }}
                      formatter={(v: number, name: string) => [v, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: CPU utilization per resource ──────────────────────────── */}
      {cpuData.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">CPU Utilization — Idle Resources</h3>
            <p className="text-xs text-muted-foreground mb-4">Average and p95 CPU% for flagged instances (threshold: 10%)</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cpuData} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                    width={36}
                    domain={[0, 20]}
                  />
                  {/* Threshold reference line drawn as a custom tick */}
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px", color: "var(--foreground)" }}
                    formatter={(v: number, name: string) => [`${v}%`, name === "avg" ? "Avg CPU" : "p95 CPU"]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }} formatter={(v) => v === "avg" ? "Avg CPU" : "p95 CPU"} />
                  <Bar dataKey="avg" fill="var(--chart-2)" fillOpacity={0.75} radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="p95" fill="var(--chart-3)" fillOpacity={0.6} radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

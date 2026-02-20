"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  TrendingDown,
  DollarSign,
  CheckCircle2,
  Clock,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useFindings } from "@/hooks/use-findings"
import { buildSavingsOverview } from "@/lib/overview"

export function AnalyticsSection() {
  const { data: triggers, loading, error } = useFindings()
  const overview = buildSavingsOverview(triggers)

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

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border bg-card">
            <CardContent className="flex items-start gap-3 p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.iconClass}`}
              >
                <stat.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold tracking-tight text-foreground">
                  {stat.value}
                </p>
                <p className="text-[11px] text-muted-foreground">{stat.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Savings trend chart */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Savings Over Time
              </h3>
              <p className="text-xs text-muted-foreground">
                Realized savings vs. projected potential
              </p>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.savingsHistory}>
                <defs>
                  <linearGradient id="savedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--chart-1)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient
                    id="projectedGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--chart-2)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--foreground)",
                  }}
                  formatter={(v: number, name: string) => [
                    `$${v.toLocaleString()}`,
                    name === "saved" ? "Realized" : "Projected",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="var(--chart-2)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fill="url(#projectedGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="saved"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#savedGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {loading && (
            <p className="mt-3 text-xs text-muted-foreground">
              Loading live metrics...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

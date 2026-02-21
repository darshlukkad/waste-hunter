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
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

      {/* Findings + Savings chart */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Findings & Savings by Month
              </h3>
              <p className="text-xs text-muted-foreground">
                Detected vs approved findings, with cumulative monthly savings
              </p>
            </div>
            {loading && (
              <span className="text-xs text-muted-foreground">Updating…</span>
            )}
          </div>
          <div className="h-50">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={overview.savingsHistory}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
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
                {/* Left axis: finding counts */}
                <YAxis
                  yAxisId="count"
                  orientation="left"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  allowDecimals={false}
                />
                {/* Right axis: savings in $ */}
                <YAxis
                  yAxisId="savings"
                  orientation="right"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--foreground)",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "savings") return [`$${value.toLocaleString()}`, "Savings"]
                    if (name === "detected") return [value, "Detected"]
                    if (name === "approved") return [value, "Approved"]
                    return [value, name]
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  formatter={(value) =>
                    value === "detected" ? "Detected" : value === "approved" ? "Approved" : "Savings ($)"
                  }
                />
                <Bar
                  yAxisId="count"
                  dataKey="detected"
                  fill="var(--chart-2)"
                  fillOpacity={0.35}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  yAxisId="count"
                  dataKey="approved"
                  fill="var(--chart-1)"
                  fillOpacity={0.8}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  yAxisId="savings"
                  type="monotone"
                  dataKey="savings"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--chart-3)" }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

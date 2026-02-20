"use client"

import { costSummary } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

export function SavingsChart() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">
          Cost & Savings Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={costSummary.monthlyCostTrend}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.65 0.18 250)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.65 0.18 250)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="oklch(0.72 0.19 155)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="oklch(0.72 0.19 155)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="oklch(0.26 0.005 260)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                axisLine={{ stroke: "oklch(0.26 0.005 260)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "oklch(0.65 0 0)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.17 0.005 260)",
                  border: "1px solid oklch(0.26 0.005 260)",
                  borderRadius: "8px",
                  color: "oklch(0.95 0 0)",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [
                  `$${value.toLocaleString()}`,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "oklch(0.65 0 0)" }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                name="Total Cost"
                stroke="oklch(0.65 0.18 250)"
                fillOpacity={1}
                fill="url(#costGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="savings"
                name="Savings"
                stroke="oklch(0.72 0.19 155)"
                fillOpacity={1}
                fill="url(#savingsGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

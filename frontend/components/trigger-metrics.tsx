"use client"

import type { MetricPoint } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"

interface TriggerMetricsProps {
  metrics: MetricPoint[]
}

function MetricChart({
  data,
  dataKey,
  color,
  unit,
}: {
  data: MetricPoint[]
  dataKey: keyof MetricPoint
  color: string
  unit: string
}) {
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="oklch(0.26 0.005 260)"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: "oklch(0.65 0 0)", fontSize: 10 }}
            axisLine={{ stroke: "oklch(0.26 0.005 260)" }}
            tickLine={false}
            tickFormatter={(v: string) => format(new Date(v), "HH:mm")}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "oklch(0.65 0 0)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}${unit}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "oklch(0.17 0.005 260)",
              border: "1px solid oklch(0.26 0.005 260)",
              borderRadius: "8px",
              color: "oklch(0.95 0 0)",
              fontSize: "11px",
            }}
            labelFormatter={(v: string) =>
              format(new Date(v), "MMM d, HH:mm")
            }
            formatter={(value: number) => [`${value}${unit}`, dataKey]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TriggerMetrics({ metrics }: TriggerMetricsProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground">
          Resource Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cpu" className="w-full">
          <TabsList className="mb-4 bg-secondary">
            <TabsTrigger value="cpu" className="text-xs">
              CPU
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-xs">
              Memory
            </TabsTrigger>
            <TabsTrigger value="requests" className="text-xs">
              Requests
            </TabsTrigger>
            <TabsTrigger value="cost" className="text-xs">
              Cost
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cpu">
            <MetricChart
              data={metrics}
              dataKey="cpu"
              color="oklch(0.65 0.18 250)"
              unit="%"
            />
          </TabsContent>
          <TabsContent value="memory">
            <MetricChart
              data={metrics}
              dataKey="memory"
              color="oklch(0.72 0.19 155)"
              unit="%"
            />
          </TabsContent>
          <TabsContent value="requests">
            <MetricChart
              data={metrics}
              dataKey="requests"
              color="oklch(0.80 0.15 75)"
              unit=""
            />
          </TabsContent>
          <TabsContent value="cost">
            <MetricChart
              data={metrics}
              dataKey="cost"
              color="oklch(0.60 0.20 310)"
              unit="$"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

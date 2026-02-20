"use client"

import { costSummary } from "@/lib/data"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowDownRight,
  DollarSign,
  Server,
  ServerOff,
  TrendingDown,
} from "lucide-react"

const stats = [
  {
    label: "Monthly Cost",
    value: `$${costSummary.totalMonthlyCost.toLocaleString()}`,
    icon: DollarSign,
    description: "Current infrastructure spend",
    accent: false,
  },
  {
    label: "Total Savings",
    value: `$${costSummary.totalSavings.toLocaleString()}`,
    icon: TrendingDown,
    description: `${costSummary.savingsPercent}% reduction`,
    accent: true,
  },
  {
    label: "Active Services",
    value: costSummary.activeServices.toString(),
    icon: Server,
    description: "Running at full capacity",
    accent: false,
  },
  {
    label: "Idle / Downsized",
    value: `${costSummary.idleServices + costSummary.downsizedServices}`,
    icon: ServerOff,
    description: `${costSummary.idleServices} idle, ${costSummary.downsizedServices} downsized`,
    accent: false,
  },
]

export function CostOverview() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.label}
          className={`relative overflow-hidden border-border ${
            stat.accent
              ? "border-primary/30 bg-primary/5"
              : "bg-card"
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </p>
              <stat.icon
                className={`h-4 w-4 ${
                  stat.accent ? "text-primary" : "text-muted-foreground"
                }`}
              />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p
                className={`text-2xl font-bold tracking-tight ${
                  stat.accent ? "text-primary" : "text-foreground"
                }`}
              >
                {stat.value}
              </p>
              {stat.accent && (
                <ArrowDownRight className="h-4 w-4 text-primary" />
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

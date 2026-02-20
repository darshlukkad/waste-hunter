"use client"

import Link from "next/link"
import { triggers, type TriggerStatus, type TriggerSeverity } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Circle,
  AlertTriangle,
  MapPin,
  Clock,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const statusConfig: Record<
  TriggerStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  },
  idle: {
    label: "Idle",
    className: "bg-warning/15 text-warning border-warning/30",
  },
  downsized: {
    label: "Downsized",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  paused: {
    label: "Paused",
    className: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  },
}

const severityConfig: Record<TriggerSeverity, { icon: typeof Circle; className: string }> = {
  low: { icon: Circle, className: "text-muted-foreground" },
  medium: { icon: Circle, className: "text-chart-2" },
  high: { icon: AlertTriangle, className: "text-warning" },
  critical: { icon: AlertTriangle, className: "text-destructive" },
}

export function TriggerList() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium text-foreground">
          Downsize Triggers
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {triggers.length} services monitored
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {triggers.map((trigger) => {
            const status = statusConfig[trigger.status]
            const severity = severityConfig[trigger.severity]
            const SeverityIcon = severity.icon
            return (
              <Link
                key={trigger.id}
                href={`/trigger/${trigger.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <SeverityIcon
                      className={`h-3 w-3 shrink-0 ${severity.className}`}
                    />
                    <span className="truncate font-mono text-sm font-medium text-foreground">
                      {trigger.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] font-medium px-1.5 py-0 ${status.className}`}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{trigger.service}</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {trigger.region}
                    </span>
                    {trigger.lastActive && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(trigger.lastActive), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {trigger.savings > 0 ? (
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        -${trigger.savings.toFixed(0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        /month
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No savings</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

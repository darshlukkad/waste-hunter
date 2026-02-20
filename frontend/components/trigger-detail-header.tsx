"use client"

import Link from "next/link"
import type { Trigger, TriggerStatus } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, MapPin, Clock, Cpu, HardDrive, Zap } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const statusConfig: Record<TriggerStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-chart-2/15 text-chart-2 border-chart-2/30" },
  idle: { label: "Idle", className: "bg-warning/15 text-warning border-warning/30" },
  downsized: { label: "Downsized", className: "bg-primary/15 text-primary border-primary/30" },
  paused: { label: "Paused", className: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30" },
}

interface TriggerDetailHeaderProps {
  trigger: Trigger
}

export function TriggerDetailHeader({ trigger }: TriggerDetailHeaderProps) {
  const status = statusConfig[trigger.status]

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground w-fit"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-lg font-semibold tracking-tight text-foreground">
              {trigger.name}
            </h1>
            <Badge
              variant="outline"
              className={`text-[10px] font-medium px-2 py-0.5 ${status.className}`}
            >
              {status.label}
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{trigger.service}</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {trigger.region}
            </span>
            {trigger.lastActive && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last active{" "}
                {formatDistanceToNow(new Date(trigger.lastActive), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>

        {/* Cost Savings Banner */}
        {trigger.savings > 0 && (
          <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-sm font-mono font-medium text-foreground">
                ${trigger.currentCost}/mo
              </p>
            </div>
            <div className="text-primary text-lg font-medium">{">"}</div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">After Downsize</p>
              <p className="text-sm font-mono font-medium text-primary">
                ${trigger.projectedCost}/mo
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
          <Cpu className="h-4 w-4 text-chart-2" />
          <div>
            <p className="text-[10px] text-muted-foreground">CPU</p>
            <p className="text-sm font-mono font-medium text-foreground">
              {trigger.cpu}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">Memory</p>
            <p className="text-sm font-mono font-medium text-foreground">
              {trigger.memory}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
          <Zap className="h-4 w-4 text-warning" />
          <div>
            <p className="text-[10px] text-muted-foreground">Requests</p>
            <p className="text-sm font-mono font-medium text-foreground">
              {trigger.requests.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

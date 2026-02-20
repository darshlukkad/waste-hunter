"use client"

import Link from "next/link"
import { type BlastRisk, type TriggerStatus } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import {
  Server,
  Database,
  Globe,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useFindings } from "@/hooks/use-findings"

const riskConfig: Record<BlastRisk, { label: string; className: string }> = {
  SAFE: {
    label: "SAFE",
    className: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  },
  LOW: {
    label: "LOW",
    className: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  },
  MEDIUM: {
    label: "MEDIUM",
    className: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  },
  CRITICAL: {
    label: "CRITICAL",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
}

const statusConfig: Record<
  TriggerStatus,
  { label: string; icon: typeof Clock; className: string }
> = {
  detected: {
    label: "Detected",
    icon: Clock,
    className: "text-muted-foreground",
  },
  analyzing: {
    label: "Analyzing",
    icon: Loader2,
    className: "text-chart-3",
  },
  pr_ready: {
    label: "PR Ready",
    icon: ArrowRight,
    className: "text-chart-2",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className: "text-chart-1",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "text-destructive",
  },
}

const serviceIcons: Record<string, typeof Server> = {
  EC2: Server,
  ElastiCache: Database,
}

export function TriggersList() {
  const { data: triggers, loading, error } = useFindings()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading findings...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
        Failed to load findings: {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Active Triggers
        </h2>
        <span className="text-xs text-muted-foreground">
          {triggers.length} findings
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {triggers.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            No findings yet. The next backend scan will populate this list.
          </div>
        )}
        {triggers.map((trigger) => {
          const risk = riskConfig[trigger.blastRisk]
          const status = statusConfig[trigger.status]
          const StatusIcon = status.icon
          const ServiceIcon = serviceIcons[trigger.service] || Server

          return (
            <Link
              key={trigger.id}
              href={`/trigger/${trigger.id}`}
              className={cn(
                "group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-all",
                "hover:border-primary/30 hover:bg-card/80 hover:shadow-sm"
              )}
            >
              {/* Service icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <ServiceIcon className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-foreground truncate">
                    {trigger.resourceName}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] font-semibold px-1.5 py-0",
                      risk.className
                    )}
                  >
                    {risk.label}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {trigger.region}
                  </span>
                  <span className="font-mono">
                    {trigger.currentInstance}
                  </span>
                  <ArrowRight className="h-3 w-3 text-chart-1" />
                  <span className="font-mono font-medium text-foreground">
                    {trigger.recommendedInstance}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                <StatusIcon
                  className={cn(
                    "h-3.5 w-3.5",
                    status.className,
                    trigger.status === "analyzing" && "animate-spin"
                  )}
                />
                <span className={cn("text-xs font-medium", status.className)}>
                  {status.label}
                </span>
              </div>

              {/* Savings */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-chart-1">
                  -${trigger.monthlySavings}
                  <span className="text-xs font-normal text-muted-foreground">
                    /mo
                  </span>
                </p>
              </div>

              {/* Arrow */}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

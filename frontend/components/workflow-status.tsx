"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { WorkflowState, WorkflowStepStatus } from "@/lib/data"
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkflowStatusProps {
  workflow?: WorkflowState
}

const statusConfig: Record<WorkflowStepStatus, { icon: typeof Clock; className: string }> = {
  complete: { icon: CheckCircle2, className: "text-chart-1" },
  active: { icon: Loader2, className: "text-chart-3" },
  pending: { icon: Clock, className: "text-muted-foreground" },
  failed: { icon: XCircle, className: "text-destructive" },
}

const badgeConfig: Record<WorkflowState["status"], { label: string; className: string }> = {
  idle: { label: "Idle", className: "bg-muted text-muted-foreground" },
  running: { label: "Running", className: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
  waiting: { label: "Waiting", className: "bg-chart-2/15 text-chart-2 border-chart-2/30" },
  approved: { label: "Approved", className: "bg-chart-1/15 text-chart-1 border-chart-1/30" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive border-destructive/30" },
}

export function WorkflowStatus({ workflow }: WorkflowStatusProps) {
  if (!workflow) {
    return null
  }

  const badge = badgeConfig[workflow.status]

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Backend Workflow
            </p>
            <p className="text-xs text-muted-foreground">
              {workflow.label}
            </p>
          </div>
          <Badge variant="outline" className={cn("text-[10px] font-semibold", badge.className)}>
            {badge.label}
          </Badge>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {workflow.steps.map((step) => {
            const config = statusConfig[step.status]
            const StepIcon = config.icon
            return (
              <div key={step.id} className="flex items-start gap-3">
                <StepIcon
                  className={cn(
                    "mt-0.5 h-4 w-4",
                    config.className,
                    step.status === "active" && "animate-spin"
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-xs text-muted-foreground">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  XCircle,
  GitPullRequest,
  AlertTriangle,
  DollarSign,
  Loader2,
  ExternalLink,
} from "lucide-react"

interface ApprovalCardProps {
  resourceId: string
  resourceName: string
  fromType: string
  toType: string
  monthlySavings: number
  annualSavings: number
  blastRisk: "SAFE" | "LOW" | "MEDIUM" | "CRITICAL"
  blastReasons: string[]
  prUrl: string
  prNumber: number
  action?: "approve" | "reject"
  reason?: string
  /** CopilotKit render status */
  status?: "inProgress" | "executing" | "complete"
  onApprove?: () => Promise<void>
  onReject?: (reason: string) => Promise<void>
}

const riskColor: Record<string, string> = {
  SAFE:     "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  LOW:      "bg-yellow-500/15  text-yellow-400  border-yellow-500/30",
  MEDIUM:   "bg-orange-500/15  text-orange-400  border-orange-500/30",
  CRITICAL: "bg-destructive/15 text-destructive  border-destructive/30",
}

export function ApprovalCard({
  resourceId,
  resourceName,
  fromType,
  toType,
  monthlySavings,
  annualSavings,
  blastRisk,
  blastReasons,
  prUrl,
  prNumber,
  action,
  reason,
  status,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)
  const [done, setDone] = useState<"approved" | "rejected" | null>(null)
  const [rejectInput, setRejectInput] = useState("")
  const [showReject, setShowReject] = useState(false)

  const isExecuting = status === "executing" || status === "inProgress"

  const handleApprove = async () => {
    setLoading("approve")
    try {
      await onApprove?.()
      setDone("approved")
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async () => {
    if (!rejectInput.trim()) return
    setLoading("reject")
    try {
      await onReject?.(rejectInput)
      setDone("rejected")
    } finally {
      setLoading(null)
    }
  }

  return (
    <Card className="border-border bg-card w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
          <GitPullRequest className="h-4 w-4 text-primary" />
          Downsize PR #{prNumber}
          {done === "approved" && (
            <Badge className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
              Merged
            </Badge>
          )}
          {done === "rejected" && (
            <Badge className="ml-auto bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
              Rejected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Resource Info */}
        <div className="rounded-md border border-border bg-secondary/50 p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resource</span>
            <span className="font-mono font-medium text-foreground">{resourceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Change</span>
            <span className="font-mono text-foreground">
              {fromType} <span className="text-primary">→</span> {toType}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monthly savings</span>
            <span className="font-mono font-semibold text-primary">
              ${monthlySavings.toLocaleString()}/mo
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Annual savings</span>
            <span className="font-mono text-foreground">
              ${annualSavings.toLocaleString()}/yr
            </span>
          </div>
        </div>

        {/* Blast Risk */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Blast Risk</span>
            <Badge variant="outline" className={`ml-auto text-[10px] ${riskColor[blastRisk]}`}>
              {blastRisk}
            </Badge>
          </div>
          <ul className="space-y-1">
            {blastReasons.map((r, i) => (
              <li key={i} className="text-[10px] text-muted-foreground leading-tight pl-1 border-l border-border">
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* PR Link */}
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          View PR on GitHub
        </a>

        {/* Actions */}
        {!done && (
          <>
            {!showReject ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApprove}
                  disabled={!!loading || isExecuting}
                >
                  {loading === "approve" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={() => setShowReject(true)}
                  disabled={!!loading || isExecuting}
                >
                  <XCircle className="h-3 w-3" />
                  Reject
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <textarea
                  className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={2}
                  placeholder="Reason for rejection…"
                  value={rejectInput}
                  onChange={(e) => setRejectInput(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => setShowReject(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-destructive hover:bg-destructive/90 text-white"
                    onClick={handleReject}
                    disabled={!rejectInput.trim() || loading === "reject"}
                  >
                    {loading === "reject" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Confirm Reject
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {done === "approved" && (
          <p className="text-[10px] text-emerald-400 text-center">
            PR merged. Changes will be applied on next deploy.
          </p>
        )}
        {done === "rejected" && (
          <p className="text-[10px] text-muted-foreground text-center">
            PR closed. Reason recorded in agent memory.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

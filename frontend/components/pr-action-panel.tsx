"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react"

interface PrActionPanelProps {
  prUrl: string | null
  prTitle: string
  status: string
}

export function PrActionPanel({ prUrl, prTitle, status }: PrActionPanelProps) {
  const [actionTaken, setActionTaken] = useState<"approved" | "rejected" | null>(
    status === "approved" ? "approved" : status === "rejected" ? "rejected" : null
  )
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const handleApprove = () => {
    setActionTaken("approved")
    setShowRejectInput(false)
  }

  const handleReject = () => {
    if (showRejectInput && rejectReason.trim()) {
      setActionTaken("rejected")
      setShowRejectInput(false)
    } else {
      setShowRejectInput(true)
    }
  }

  const handleReset = () => {
    setActionTaken(null)
    setShowRejectInput(false)
    setRejectReason("")
  }

  // No PR yet
  if (!prUrl) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <GitPullRequest className="h-8 w-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            No PR created yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            A pull request will be generated once analysis completes.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-5">
        {/* PR info */}
        <div className="flex items-start gap-3 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chart-2/10">
            <GitPullRequest className="h-5 w-5 text-chart-2" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground text-balance">
              {prTitle}
            </p>
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View on GitHub
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Action taken state */}
        {actionTaken && (
          <div
            className={`rounded-lg border p-4 ${
              actionTaken === "approved"
                ? "border-chart-1/30 bg-chart-1/8"
                : "border-destructive/30 bg-destructive/8"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionTaken === "approved" ? (
                <CheckCircle2 className="h-5 w-5 text-chart-1" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <p
                className={`text-sm font-semibold ${
                  actionTaken === "approved"
                    ? "text-chart-1"
                    : "text-destructive"
                }`}
              >
                {actionTaken === "approved"
                  ? "PR Approved - Downsize will proceed"
                  : "PR Rejected - No changes will be made"}
              </p>
            </div>
            {actionTaken === "rejected" && rejectReason && (
              <p className="mt-2 text-xs text-muted-foreground">
                Reason: {rejectReason}
              </p>
            )}
            <button
              onClick={handleReset}
              className="mt-3 text-xs text-primary hover:underline"
            >
              Undo action
            </button>
          </div>
        )}

        {/* Approve / Reject buttons */}
        {!actionTaken && (
          <div className="flex flex-col gap-3">
            {showRejectInput && (
              <Textarea
                placeholder="Why are you rejecting this change? This helps the AI improve future recommendations..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-[80px] resize-none text-sm bg-secondary/30 border-border placeholder:text-muted-foreground/50"
                autoFocus
              />
            )}
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 gap-2 bg-chart-1 hover:bg-chart-1/90 text-sm font-semibold"
                style={{ color: "var(--background)" }}
                onClick={handleApprove}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve PR
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-semibold"
                onClick={handleReject}
              >
                <XCircle className="h-4 w-4" />
                {showRejectInput ? "Submit Rejection" : "Reject PR"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

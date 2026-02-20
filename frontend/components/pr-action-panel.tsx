"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  GitBranch,
} from "lucide-react"
import { approveFinding, rejectFinding, createPr } from "@/lib/backend"
import type { TriggerStatus } from "@/lib/data"

interface PrActionPanelProps {
  resourceId: string
  prUrl: string | null
  prTitle: string
  status: TriggerStatus
  onActionComplete?: () => void
}

export function PrActionPanel({
  resourceId,
  prUrl,
  prTitle,
  status,
  onActionComplete,
}: PrActionPanelProps) {
  const [actionTaken, setActionTaken] = useState<"approved" | "rejected" | null>(
    status === "approved" ? "approved" : status === "rejected" ? "rejected" : null
  )
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [creatingPr, setCreatingPr] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backendMessage, setBackendMessage] = useState<string | null>(null)

  useEffect(() => {
    setActionTaken(
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : null
    )
  }, [status])

  const handleApprove = async () => {
    setSubmitting(true)
    setError(null)
    setBackendMessage(null)
    try {
      const response = await approveFinding(resourceId)
      setActionTaken("approved")
      setShowRejectInput(false)
      if (response.message) {
        setBackendMessage(response.message)
      }
      onActionComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed")
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!showRejectInput) {
      setShowRejectInput(true)
      return
    }
    if (!rejectReason.trim()) {
      setError("Please provide a rejection reason.")
      return
    }
    setSubmitting(true)
    setError(null)
    setBackendMessage(null)
    try {
      const response = await rejectFinding(resourceId, rejectReason.trim())
      setActionTaken("rejected")
      setShowRejectInput(false)
      if (response.message) {
        setBackendMessage(response.message)
      }
      onActionComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed")
    } finally {
      setSubmitting(false)
    }
  }


  const handleCreatePr = async () => {
    setCreatingPr(true)
    setError(null)
    setBackendMessage(null)
    try {
      const response = await createPr(resourceId)
      if (response.message) setBackendMessage(response.message)
      onActionComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "PR creation failed")
    } finally {
      setCreatingPr(false)
    }
  }

  // No PR yet — show Create PR button
  if (!prUrl) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chart-2/10">
            <GitBranch className="h-6 w-6 text-chart-2" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">No PR created yet</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Rewrite IaC via MiniMax and open a GitHub PR for this finding.
            </p>
          </div>
          {error && (
            <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {backendMessage && (
            <div className="w-full rounded-lg border border-chart-1/30 bg-chart-1/5 px-3 py-2 text-xs text-chart-1">
              {backendMessage}
            </div>
          )}
          <Button
            size="lg"
            className="gap-2 bg-chart-2 hover:bg-chart-2/90 text-sm font-semibold"
            style={{ color: "var(--background)" }}
            onClick={handleCreatePr}
            disabled={creatingPr}
          >
            {creatingPr ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitPullRequest className="h-4 w-4" />
            )}
            {creatingPr ? "Creating PR…" : "Create PR"}
          </Button>
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
            {backendMessage && (
              <p className="mt-2 text-xs text-muted-foreground">
                {backendMessage}
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
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
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {submitting ? "Approving..." : "Approve PR"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-semibold"
                onClick={handleReject}
                disabled={submitting}
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

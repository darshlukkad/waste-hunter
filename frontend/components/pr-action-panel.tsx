"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  GitPullRequest,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react"
import { approveFinding, rejectFinding, getPrProgress } from "@/lib/backend"
import type { PrProgress } from "@/lib/backend"
import type { TriggerStatus } from "@/lib/data"

const PR_STEPS: { key: PrProgress["step"]; label: string }[] = [
  { key: "seeding",    label: "Seeding repo files" },
  { key: "reading",    label: "Reading current IaC" },
  { key: "rewriting",  label: "MiniMax rewriting Terraform + K8s" },
  { key: "committing", label: "Committing & opening PR" },
  { key: "done",       label: "PR created" },
]

function stepIndex(step: PrProgress["step"]): number {
  return PR_STEPS.findIndex((s) => s.key === step)
}

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
  const [error, setError] = useState<string | null>(null)
  const [backendMessage, setBackendMessage] = useState<string | null>(null)
  const [progress, setProgress] = useState<PrProgress | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setActionTaken(
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : null
    )
  }, [status])

  // Poll progress whenever there's no PR yet
  useEffect(() => {
    if (prUrl) return
    if (pollRef.current) return

    pollRef.current = setInterval(async () => {
      try {
        const prog = await getPrProgress(resourceId)
        console.log(`[PR ${resourceId}] step=${prog.step} done=${prog.done} error=${prog.error ?? "none"}`)
        setProgress(prog)
        if (prog.done) {
          clearInterval(pollRef.current!)
          pollRef.current = null
          if (prog.error) {
            console.error(`[PR ${resourceId}] FAILED:`, prog.error)
            setError(prog.error)
          } else {
            console.log(`[PR ${resourceId}] SUCCESS: pr_url=${prog.pr_url}`)
            onActionComplete?.()
          }
        }
      } catch (err) {
        console.warn(`[PR ${resourceId}] poll error:`, err)
      }
    }, 1500)

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [prUrl, resourceId, onActionComplete])

  // ── No PR yet: show live creation progress ─────────────────────────────────
  if (!prUrl) {
    const currentStepIdx = progress ? stepIndex(progress.step) : 0
    const allDone = progress?.step === "done"

    return (
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Creating PR…</p>
          <div className="flex flex-col gap-2.5">
            {PR_STEPS.map((s, i) => {
              const isDone   = allDone || i < currentStepIdx
              const isActive = !allDone && i === currentStepIdx
              return (
                <div key={s.key} className="flex items-center gap-2.5 text-xs">
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-chart-1" />
                  ) : isActive ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-chart-2" />
                  ) : (
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/30" />
                  )}
                  <span className={
                    isDone   ? "text-chart-1" :
                    isActive ? "text-foreground font-medium" :
                               "text-muted-foreground/40"
                  }>
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
          {error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── PR exists: show approve/reject ─────────────────────────────────────────
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
          <div className={`rounded-lg border p-4 ${
            actionTaken === "approved"
              ? "border-chart-1/30 bg-chart-1/8"
              : "border-destructive/30 bg-destructive/8"
          }`}>
            <div className="flex items-center gap-2">
              {actionTaken === "approved" ? (
                <CheckCircle2 className="h-5 w-5 text-chart-1" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <p className={`text-sm font-semibold ${actionTaken === "approved" ? "text-chart-1" : "text-destructive"}`}>
                {actionTaken === "approved"
                  ? "PR Approved - Downsize will proceed"
                  : "PR Rejected - No changes will be made"}
              </p>
            </div>
            {actionTaken === "rejected" && rejectReason && (
              <p className="mt-2 text-xs text-muted-foreground">Reason: {rejectReason}</p>
            )}
            {backendMessage && (
              <p className="mt-2 text-xs text-muted-foreground">{backendMessage}</p>
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
                className="min-h-20 resize-none text-sm bg-secondary/30 border-border placeholder:text-muted-foreground/50"
                autoFocus
              />
            )}
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 gap-2 bg-chart-1 hover:bg-chart-1/90 text-sm font-semibold"
                style={{ color: "var(--background)" }}
                onClick={async () => {
                  setSubmitting(true)
                  setError(null)
                  setBackendMessage(null)
                  try {
                    const response = await approveFinding(resourceId)
                    setActionTaken("approved")
                    setShowRejectInput(false)
                    if (response.message) setBackendMessage(response.message)
                    onActionComplete?.()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Approval failed")
                  } finally {
                    setSubmitting(false)
                  }
                }}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? "Approving..." : "Approve PR"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1 gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-semibold"
                onClick={async () => {
                  if (!showRejectInput) { setShowRejectInput(true); return }
                  if (!rejectReason.trim()) { setError("Please provide a rejection reason."); return }
                  setSubmitting(true)
                  setError(null)
                  setBackendMessage(null)
                  try {
                    const response = await rejectFinding(resourceId, rejectReason.trim())
                    setActionTaken("rejected")
                    setShowRejectInput(false)
                    if (response.message) setBackendMessage(response.message)
                    onActionComplete?.()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Rejection failed")
                  } finally {
                    setSubmitting(false)
                  }
                }}
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

"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { type BlastRisk, type TriggerStatus, type Trigger } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  ScanSearch,
  GitPullRequest,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useFindings } from "@/hooks/use-findings"
import { triggerScan, getPrProgress } from "@/lib/backend"
import type { PrProgress } from "@/lib/backend"

const PR_STEP_LABELS: Record<PrProgress["step"], string> = {
  idle:       "Queued",
  seeding:    "Seeding repo…",
  reading:    "Reading IaC…",
  rewriting:  "Rewriting with MiniMax…",
  committing: "Committing…",
  done:       "PR ready",
  error:      "Failed",
}

function TriggerPrStatus({ trigger }: { trigger: Trigger }) {
  const [progress, setProgress] = useState<PrProgress | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (trigger.prUrl) return // already has PR, no polling needed
    if (pollRef.current) return

    // start polling immediately
    const poll = async () => {
      try {
        const prog = await getPrProgress(trigger.resourceId)
        setProgress(prog)
        if (prog.done) {
          clearInterval(pollRef.current!)
          pollRef.current = null
        }
      } catch { /* ignore */ }
    }
    void poll()
    pollRef.current = setInterval(poll, 2000)

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [trigger.prUrl, trigger.resourceId])

  // PR exists
  if (trigger.prUrl) {
    const status = statusConfig[trigger.status]
    const StatusIcon = status.icon
    return (
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <StatusIcon className={cn("h-3.5 w-3.5", status.className, trigger.status === "analyzing" && "animate-spin")} />
        <span className={cn("text-xs font-medium", status.className)}>{status.label}</span>
      </div>
    )
  }

  // PR being created — show live step
  const step = progress?.step ?? "idle"
  const isError = step === "error"
  const isDone = step === "done"
  return (
    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
      {isError ? (
        <XCircle className="h-3.5 w-3.5 text-destructive" />
      ) : isDone ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-chart-1" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-chart-2" />
      )}
      <span className={cn(
        "text-xs font-medium",
        isError ? "text-destructive" : isDone ? "text-chart-1" : "text-chart-2"
      )}>
        {PR_STEP_LABELS[step]}
      </span>
    </div>
  )
}

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
  const { data: triggers, loading, error, refetch } = useFindings()
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)

  const handleScan = async () => {
    setScanning(true)
    setScanResult(null)
    try {
      const result = await triggerScan(10.0, 60)
      setScanResult(
        result.total_idle === 0
          ? "All instances healthy — no idle resources detected."
          : result.new_findings === 0
            ? `${result.total_idle} idle resource(s) confirmed — ${result.updated_findings} existing finding(s) updated.`
            : `Found ${result.new_findings} new idle resource(s). ${result.updated_findings} existing finding(s) refreshed.`
      )
      refetch()
    } catch (err) {
      setScanResult(err instanceof Error ? err.message : "Scan failed")
    } finally {
      setScanning(false)
    }
  }

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
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {triggers.length} findings
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-3 text-xs"
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="h-3.5 w-3.5" />
            )}
            {scanning ? "Scanning…" : "Scan Now"}
          </Button>
        </div>
      </div>

      {scanResult && (
        <div className={cn(
          "rounded-lg border px-3 py-2 text-xs",
          scanResult.includes("healthy") || scanResult.includes("0 idle")
            ? "border-chart-1/30 bg-chart-1/5 text-chart-1"
            : scanResult.includes("failed") || scanResult.includes("Failed")
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-chart-2/30 bg-chart-2/5 text-chart-2"
        )}>
          {scanResult}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {triggers.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            No findings yet. The next backend scan will populate this list.
          </div>
        )}
        {triggers.map((trigger) => {
          const risk = riskConfig[trigger.blastRisk]
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

              {/* Live workflow status */}
              <TriggerPrStatus trigger={trigger} />

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

"use client"

import Link from "next/link"
import { useMemo, useCallback } from "react"
import type { Trigger, BlastRisk } from "@/lib/data"
import { TopNav } from "@/components/top-nav"
import { CodeDiff } from "@/components/code-diff"
import { AiReasoning } from "@/components/ai-reasoning"
import { PrActionPanel } from "@/components/pr-action-panel"
import { WorkflowStatus } from "@/components/workflow-status"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Server,
  Database,
  DollarSign,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useCopilotReadable, useCopilotAction } from "@copilotkit/react-core"
import { CopilotPopup } from "@copilotkit/react-ui"
import { approveFinding, rejectFinding } from "@/lib/backend"

const riskConfig: Record<BlastRisk, { className: string }> = {
  SAFE: { className: "bg-chart-1/15 text-chart-1 border-chart-1/30" },
  LOW: { className: "bg-chart-2/15 text-chart-2 border-chart-2/30" },
  MEDIUM: { className: "bg-chart-3/15 text-chart-3 border-chart-3/30" },
  CRITICAL: {
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
}

const serviceIcons: Record<string, typeof Server> = {
  EC2: Server,
  ElastiCache: Database,
}

interface TriggerDetailViewProps {
  trigger: Trigger
  onActionComplete?: () => void
}

export function TriggerDetailView({ trigger, onActionComplete }: TriggerDetailViewProps) {
  const risk = riskConfig[trigger.blastRisk]
  const ServiceIcon = serviceIcons[trigger.service] || Server

  // Memoize to avoid re-registering CopilotKit context on every render
  const findingValue = useMemo(() => ({
    resourceName: trigger.resourceName,
    resourceId: trigger.resourceId,
    service: trigger.service,
    region: trigger.region,
    currentInstance: trigger.currentInstance,
    recommendedInstance: trigger.recommendedInstance,
    monthlySavings: trigger.monthlySavings,
    yearlySavings: trigger.yearlySavings,
    blastRisk: trigger.blastRisk,
    status: trigger.status,
    detectedAt: trigger.detectedAt,
    aiReasoning: trigger.aiReasoning,
    copilotSummary: trigger.copilotSummary,
    prUrl: trigger.prUrl,
    prTitle: trigger.prTitle,
    prStatus: trigger.prStatus,
  }), [
    trigger.resourceName, trigger.resourceId, trigger.service, trigger.region,
    trigger.currentInstance, trigger.recommendedInstance, trigger.monthlySavings,
    trigger.yearlySavings, trigger.blastRisk, trigger.status, trigger.detectedAt,
    trigger.aiReasoning, trigger.copilotSummary, trigger.prUrl, trigger.prTitle,
    trigger.prStatus,
  ])

  useCopilotReadable({
    description: "The current cloud resource finding being reviewed",
    value: findingValue,
  })

  const handleApprove = useCallback(async () => {
    await approveFinding(trigger.resourceId)
    onActionComplete?.()
    return `Approved ${trigger.resourceName}. The PR will be merged to downsize from ${trigger.currentInstance} to ${trigger.recommendedInstance}, saving $${trigger.monthlySavings}/mo.`
  }, [trigger.resourceId, trigger.resourceName, trigger.currentInstance, trigger.recommendedInstance, trigger.monthlySavings, onActionComplete])

  const handleReject = useCallback(async ({ reason }: { reason: string }) => {
    await rejectFinding(trigger.resourceId, reason)
    onActionComplete?.()
    return `Rejected ${trigger.resourceName}. Reason: ${reason}`
  }, [trigger.resourceId, trigger.resourceName, onActionComplete])

  // Allow the AI to approve the finding
  useCopilotAction({
    name: "approveFinding",
    description: "Approve the cost-saving downsize recommendation and merge the pull request",
    parameters: [],
    handler: handleApprove,
  })

  // Allow the AI to reject the finding
  useCopilotAction({
    name: "rejectFinding",
    description: "Reject the cost-saving recommendation if it's not safe or suitable",
    parameters: [
      {
        name: "reason",
        type: "string",
        description: "The reason for rejecting this recommendation",
        required: true,
      },
    ],
    handler: handleReject,
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          {/* Back link */}
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <ServiceIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-mono text-lg font-bold tracking-tight text-foreground">
                    {trigger.resourceName}
                  </h1>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0",
                      risk.className
                    )}
                  >
                    {trigger.blastRisk}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono">{trigger.resourceId}</span>
                  <span className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {trigger.region}
                  </span>
                </div>
              </div>
            </div>

            {/* Savings banner */}
            <Card className="mt-4 border-chart-1/20 bg-chart-1/5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chart-1/10">
                  <DollarSign className="h-5 w-5 text-chart-1" />
                </div>
                <div className="flex flex-1 items-center gap-3">
                  <div>
                    <span className="font-mono text-sm text-muted-foreground">
                      {trigger.currentInstance}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-chart-1" />
                  <div>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {trigger.recommendedInstance}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-chart-1">
                    -${trigger.monthlySavings}/mo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ${trigger.yearlySavings.toLocaleString()}/yr
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Content sections */}
          <div className="flex flex-col gap-8">
            {/* Section: PR Action */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Pull Request
              </h2>
              <PrActionPanel
                resourceId={trigger.resourceId}
                prUrl={trigger.prUrl}
                prTitle={trigger.prTitle}
                status={trigger.status}
                onActionComplete={onActionComplete}
              />
            </section>

            {/* Section: Backend Workflow */}
            {trigger.workflow && (
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  Copilot Workflow
                </h2>
                <WorkflowStatus workflow={trigger.workflow} />
              </section>
            )}

            {/* Section: AI Reasoning */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                AI Analysis
              </h2>
              <AiReasoning
                steps={trigger.aiReasoning}
                summary={trigger.copilotSummary}
              />
            </section>

            {/* Section: Code Changes */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                Code Changes
              </h2>
              <CodeDiff changes={trigger.codeChanges} />
            </section>
          </div>
        </div>
      </main>

      <CopilotPopup
        instructions={`You are a FinOps AI assistant helping engineers review cloud cost optimization findings.
You have access to the current finding details. You can:
- Explain the AI reasoning and blast risk assessment
- Help the engineer decide whether to approve or reject the change
- Call approveFinding() to approve the PR, or rejectFinding(reason) to reject it
- Answer questions about the specific resource, instance types, and savings

Be concise, data-driven, and focus on helping the engineer make the right decision quickly.`}
        labels={{
          title: "WasteHunter Copilot",
          initial: `Hi! I'm reviewing **${trigger.resourceName}** with you.\n\nThis is a **${trigger.blastRisk} blast risk** finding — downsizing from \`${trigger.currentInstance}\` to \`${trigger.recommendedInstance}\` saves **$${trigger.monthlySavings}/mo**.\n\nShould I approve it, or do you have questions first?`,
        }}
      />
    </div>
  )
}

"use client"

import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core"
import { CopilotSidebar } from "@copilotkit/react-ui"
import "@copilotkit/react-ui/styles.css"
import { ApprovalCard } from "@/components/approval-card"
import type { Trigger } from "@/lib/data"

interface Props {
  trigger: Trigger
  children: React.ReactNode
}


export function CopilotTriggerDetail({ trigger, children }: Props) {
  const finding = trigger.finding

  // Give CopilotKit full context about this resource
  useCopilotReadable({
    description: "The current cloud resource under review for right-sizing",
    value: {
      resource_id:        trigger.id,
      name:               trigger.name,
      service:            trigger.service,
      region:             trigger.region,
      current_type:       finding?.current_type,
      recommended_type:   finding?.recommended_type,
      monthly_savings:    trigger.savings,
      annual_savings:     finding?.annual_savings_usd,
      blast_risk:         finding?.blast_risk,
      blast_reasons:      finding?.blast_reasons,
      pr_url:             finding?.pr_url,
      pr_number:          finding?.pr_number,
      pr_is_draft:        finding?.pr_is_draft,
      cpu_avg:            trigger.cpu,
      memory_avg:         trigger.memory,
      confidence:         finding?.confidence,
    },
  })

  // Action: Approve PR — renders an ApprovalCard inside the chat
  useCopilotAction({
    name: "approve_downsize_pr",
    description:
      "Approve and merge the GitHub PR that downsizes this resource. " +
      "Show an approval card and then merge the PR via the backend.",
    parameters: [
      { name: "resource_id", type: "string", description: "AWS resource ID", required: true },
    ],
    render: ({ args, status }) => {
      if (!finding) return <p className="text-xs text-muted-foreground">No PR found.</p>
      return (
        <ApprovalCard
          resourceId={args.resource_id ?? trigger.id}
          resourceName={trigger.name}
          fromType={finding.current_type}
          toType={finding.recommended_type}
          monthlySavings={trigger.savings}
          annualSavings={finding.annual_savings_usd}
          blastRisk={finding.blast_risk as "SAFE" | "LOW" | "MEDIUM" | "CRITICAL"}
          blastReasons={finding.blast_reasons}
          prUrl={finding.pr_url}
          prNumber={finding.pr_number}
          action="approve"
          status={status}
          onApprove={async () => {
            const res = await fetch(`/api/backend/approve/${trigger.id}`, { method: "POST" })
            if (!res.ok) throw new Error(await res.text())
          }}
        />
      )
    },
    handler: async ({ resource_id }) => {
      const res = await fetch(`/api/backend/approve/${resource_id}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) return `Error: ${data.detail}`
      return `PR #${data.pr_number} merged successfully. $${trigger.savings}/month in savings is now active.`
    },
  })

  // Action: Reject PR — renders a rejection card inside the chat
  useCopilotAction({
    name: "reject_downsize_pr",
    description:
      "Reject the GitHub PR and record the reason in Neo4j agent memory " +
      "so the system won't auto-suggest the same downsize for this resource.",
    parameters: [
      { name: "resource_id", type: "string", description: "AWS resource ID", required: true },
      { name: "reason",      type: "string", description: "Why this PR is being rejected", required: true },
    ],
    render: ({ args, status }) => {
      if (!finding) return <p className="text-xs text-muted-foreground">No PR found.</p>
      return (
        <ApprovalCard
          resourceId={args.resource_id ?? trigger.id}
          resourceName={trigger.name}
          fromType={finding.current_type}
          toType={finding.recommended_type}
          monthlySavings={trigger.savings}
          annualSavings={finding.annual_savings_usd}
          blastRisk={finding.blast_risk as "SAFE" | "LOW" | "MEDIUM" | "CRITICAL"}
          blastReasons={finding.blast_reasons}
          prUrl={finding.pr_url}
          prNumber={finding.pr_number}
          action="reject"
          reason={args.reason}
          status={status}
          onReject={async (reason) => {
            const res = await fetch(`/api/backend/reject/${trigger.id}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            })
            if (!res.ok) throw new Error(await res.text())
          }}
        />
      )
    },
    handler: async ({ resource_id, reason }) => {
      const res = await fetch(`/api/backend/reject/${resource_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) return `Error: ${data.detail}`
      return `PR #${data.pr_number} closed. Reason "${reason}" recorded in Neo4j agent memory — won't resurface until context changes.`
    },
  })

  const hasPR = !!finding?.pr_url

  return (
    <CopilotSidebar
      defaultOpen={hasPR}
      labels={{
        title: "WasteHunter AI",
        placeholder: hasPR
          ? `Review the PR for ${trigger.name}. Say "approve" or "reject with reason…"`
          : `Ask about ${trigger.name} usage patterns or cost savings.`,
        initial: hasPR
          ? `I've found a downsize opportunity for **${trigger.name}**.\n\n` +
            `- Change: \`${finding?.current_type}\` → \`${finding?.recommended_type}\`\n` +
            `- Monthly savings: **$${trigger.savings}/mo**\n` +
            `- Blast risk: **${finding?.blast_risk}**\n\n` +
            `The PR is already open on GitHub ([#${finding?.pr_number}](${finding?.pr_url})). ` +
            `Say **"approve"** to merge it, or **"reject because <reason>"** to close it and record the decision.`
          : `I'm monitoring **${trigger.name}**. What would you like to know?`,
      }}
      instructions={
        `You are the FinOps Waste Hunter AI assistant reviewing a cloud resource downsize recommendation.\n` +
        `Resource: ${trigger.name} (${trigger.id}) in ${trigger.region}.\n` +
        `Current type: ${finding?.current_type ?? "unknown"}, recommended: ${finding?.recommended_type ?? "unknown"}.\n` +
        `Monthly savings potential: $${trigger.savings}.\n` +
        `Blast risk: ${finding?.blast_risk ?? "unknown"}.\n\n` +
        `When the user says "approve" or similar, call approve_downsize_pr.\n` +
        `When the user says "reject" or gives a reason to delay, call reject_downsize_pr with their reason.\n` +
        `Always show the approval card UI via the render function.`
      }
    >
      {children}
    </CopilotSidebar>
  )
}

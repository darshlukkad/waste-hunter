import { format, subMonths } from "date-fns"
import type { SavingsOverview, Trigger } from "@/lib/data"

export function buildSavingsOverview(triggers: Trigger[]): SavingsOverview {
  const totalMonthlySavings = triggers.reduce(
    (sum, trigger) => sum + trigger.monthlySavings,
    0
  )
  const totalYearlySavings = triggers.reduce(
    (sum, trigger) => sum + trigger.yearlySavings,
    0
  )

  const approvedCount = triggers.filter((t) => t.status === "approved").length
  const rejectedCount = triggers.filter((t) => t.status === "rejected").length
  const pendingCount = triggers.filter(
    (t) => t.status !== "approved" && t.status !== "rejected"
  ).length

  const totalFindings = triggers.length
  const approvalRatio = totalFindings > 0 ? approvedCount / totalFindings : 0
  const baseProjected = totalMonthlySavings || 0

  const savingsHistory = Array.from({ length: 6 }, (_, index) => {
    const monthDate = subMonths(new Date(), 5 - index)
    const ramp = 0.65 + index * 0.07
    const projected = Math.round(baseProjected * ramp)
    const saved = Math.round(projected * approvalRatio)
    return {
      month: format(monthDate, "MMM"),
      saved,
      projected,
    }
  })

  return {
    totalMonthlySavings,
    totalYearlySavings,
    totalFindings,
    approvedCount,
    rejectedCount,
    pendingCount,
    savingsHistory,
  }
}

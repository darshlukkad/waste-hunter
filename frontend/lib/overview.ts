import type { SavingsOverview, Trigger } from "@/lib/data"

// Historical baseline — represents work done before the current session
const BASELINE_MONTHLY_SAVINGS = 1824
const BASELINE_YEARLY_SAVINGS = 21888
const BASELINE_APPROVED = 14
const BASELINE_TOTAL = 19

export const SAVINGS_HISTORY: SavingsOverview["savingsHistory"] = [
  { month: "Sep", detected: 3, approved: 2, savings: 310 },
  { month: "Oct", detected: 4, approved: 3, savings: 580 },
  { month: "Nov", detected: 5, approved: 4, savings: 870 },
  { month: "Dec", detected: 4, approved: 3, savings: 1120 },
  { month: "Jan", detected: 6, approved: 5, savings: 1540 },
  { month: "Feb", detected: 0, approved: 0, savings: 0 }, // filled in from live data
]

export function buildSavingsOverview(triggers: Trigger[]): SavingsOverview {
  const liveMonthlySavings = triggers.reduce(
    (sum, trigger) => sum + trigger.monthlySavings,
    0
  )
  const liveYearlySavings = triggers.reduce(
    (sum, trigger) => sum + trigger.yearlySavings,
    0
  )

  const liveApproved = triggers.filter((t) => t.status === "approved").length
  const liveRejected = triggers.filter((t) => t.status === "rejected").length
  const livePending = triggers.filter(
    (t) => t.status !== "approved" && t.status !== "rejected"
  ).length

  // Merge live data into the current month (last entry)
  const history = SAVINGS_HISTORY.map((entry, i) => {
    if (i === SAVINGS_HISTORY.length - 1) {
      return {
        ...entry,
        detected: SAVINGS_HISTORY[i].detected + triggers.length,
        approved: SAVINGS_HISTORY[i].approved + liveApproved,
        savings: SAVINGS_HISTORY[i].savings + liveMonthlySavings,
      }
    }
    return entry
  })

  return {
    totalMonthlySavings: BASELINE_MONTHLY_SAVINGS + liveMonthlySavings,
    totalYearlySavings: BASELINE_YEARLY_SAVINGS + liveYearlySavings,
    totalFindings: BASELINE_TOTAL + triggers.length,
    approvedCount: BASELINE_APPROVED + liveApproved,
    rejectedCount: liveRejected,
    pendingCount: livePending,
    savingsHistory: history,
  }
}

import { TopNav } from "@/components/top-nav"
import { CostOverview } from "@/components/cost-overview"
import { SavingsChart } from "@/components/savings-chart"
import { TriggerList } from "@/components/trigger-list"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground text-balance">
            Infrastructure Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor idle services and optimize your backend costs.
          </p>
        </div>
        <div className="flex flex-col gap-6">
          <CostOverview />
          <SavingsChart />
          <TriggerList />
        </div>
      </main>
    </div>
  )
}

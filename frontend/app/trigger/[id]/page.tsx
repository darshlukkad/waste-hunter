import { notFound } from "next/navigation"
import { getTriggerById, triggers } from "@/lib/data"
import { TopNav } from "@/components/top-nav"
import { TriggerDetailHeader } from "@/components/trigger-detail-header"
import { StateTimeline } from "@/components/state-timeline"
import { TriggerMetrics } from "@/components/trigger-metrics"
import { TriggerConfigPanel } from "@/components/trigger-config"

export function generateStaticParams() {
  return triggers.map((t) => ({ id: t.id }))
}

export default async function TriggerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const trigger = getTriggerById(id)

  if (!trigger) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <TriggerDetailHeader trigger={trigger} />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column: State Manager + Metrics */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <StateTimeline
              events={trigger.stateHistory}
              currentState={trigger.status}
            />
            <TriggerMetrics metrics={trigger.metrics} />
          </div>

          {/* Right column: Configuration */}
          <div>
            <TriggerConfigPanel
              config={trigger.config}
              status={trigger.status}
              name={trigger.name}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

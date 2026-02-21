import { TopNav } from "@/components/top-nav"
import { AnalyticsSection } from "@/components/analytics-section"
import { TriggersList } from "@/components/triggers-list"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="mb-10">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1.5">
              FinOps Intelligence
            </p>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Cost Optimization
            </h1>
          </div>
          <div className="flex flex-col gap-10">
            <AnalyticsSection />
            <TriggersList />
          </div>
        </div>
      </main>
    </div>
  )
}

import { TopNav } from "@/components/top-nav"
import { AnalyticsSection } from "@/components/analytics-section"
import { TriggersList } from "@/components/triggers-list"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
              Cost Optimization Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              AI-detected idle and over-provisioned resources. Review findings,
              inspect code changes, and approve or reject PRs.
            </p>
          </div>
          <div className="flex flex-col gap-8">
            <AnalyticsSection />
            <TriggersList />
          </div>
        </div>
      </main>
    </div>
  )
}

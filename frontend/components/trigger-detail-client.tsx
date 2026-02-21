"use client"

import Link from "next/link"
import { TriggerDetailView } from "@/components/trigger-detail-view"
import { useFinding } from "@/hooks/use-findings"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"

interface TriggerDetailClientProps {
  id: string
}

export function TriggerDetailClient({ id }: TriggerDetailClientProps) {
  const { data: trigger, loading, error, notFound, refetch } = useFinding(id)

  // Only show full-page spinner when we have no data at all (cache miss + first fetch)
  if (loading && !trigger) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-6 py-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading trigger...
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-6 py-10">
            <h1 className="text-xl font-semibold text-foreground">
              Unable to load trigger
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-6 py-10">
            <h1 className="text-xl font-semibold text-foreground">
              Trigger not found
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This resource may have been removed from the latest scan.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (!trigger) {
    return null
  }

  return (
    <TriggerDetailView
      trigger={trigger}
      onActionComplete={refetch}
      key={trigger.id}
    />
  )
}

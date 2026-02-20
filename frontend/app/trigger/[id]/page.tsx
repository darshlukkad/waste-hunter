import { notFound } from "next/navigation"
import { getTriggerById, triggers } from "@/lib/data"
import { TriggerDetailView } from "@/components/trigger-detail-view"

export function generateStaticParams() {
  return triggers.map((t) => ({ id: t.id }))
}

export default async function TriggerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const trigger = getTriggerById(id)

  if (!trigger) {
    notFound()
  }

  return <TriggerDetailView trigger={trigger} />
}

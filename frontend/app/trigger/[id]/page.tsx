import { TriggerDetailClient } from "@/components/trigger-detail-client"

export default async function TriggerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <TriggerDetailClient id={id} />
}

"use client"

import { useFindingsContext, useCachedFinding } from "@/contexts/findings-context"

/** Drop-in replacement — returns { data, loading, error, refetch } from the shared cache. */
export function useFindings() {
  const { triggers, loading, error, refetch } = useFindingsContext()
  return { data: triggers, loading, error, refetch }
}

export { useCachedFinding as useFinding } from "@/contexts/findings-context"

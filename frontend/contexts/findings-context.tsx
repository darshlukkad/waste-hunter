"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { Trigger } from "@/lib/data"
import { fetchFinding, fetchFindings, mapFindingToTrigger, getPrProgress } from "@/lib/backend"
import type { PrProgress } from "@/lib/backend"

interface FindingsContextValue {
  triggers: Trigger[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  getCached: (id: string) => Trigger | undefined
  getProgress: (id: string) => PrProgress | undefined
}

const FindingsContext = createContext<FindingsContextValue | null>(null)

export function FindingsProvider({ children }: { children: React.ReactNode }) {
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Shared PR progress cache keyed by resource_id
  const [progressMap, setProgressMap] = useState<Record<string, PrProgress>>({})
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      setError(null)
      const findings = await fetchFindings()
      if (!mountedRef.current) return
      const mapped = findings.map(mapFindingToTrigger)
      setTriggers(mapped)
      setLoading(false)

      // Poll progress for any finding that doesn't have a PR yet
      const pending = findings.filter(f => !f.pr_url)
      if (pending.length === 0) return
      const results = await Promise.allSettled(
        pending.map(f => getPrProgress(f.resource_id).then(p => ({ id: f.resource_id, p })))
      )
      if (!mountedRef.current) return
      const updates: Record<string, PrProgress> = {}
      for (const r of results) {
        if (r.status === "fulfilled") updates[r.value.id] = r.value.p
      }
      if (Object.keys(updates).length > 0) {
        setProgressMap(prev => ({ ...prev, ...updates }))
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load findings")
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void load()
    const interval = window.setInterval(load, 5000)
    return () => {
      mountedRef.current = false
      window.clearInterval(interval)
    }
  }, [load])

  const getCached = useCallback(
    (id: string) => triggers.find((t) => t.id === id),
    [triggers]
  )

  const getProgress = useCallback(
    (id: string) => progressMap[id],
    [progressMap]
  )

  return (
    <FindingsContext.Provider value={{ triggers, loading, error, refetch: load, getCached, getProgress }}>
      {children}
    </FindingsContext.Provider>
  )
}

export function useFindingsContext() {
  const ctx = useContext(FindingsContext)
  if (!ctx) throw new Error("useFindingsContext must be used inside FindingsProvider")
  return ctx
}

export function useProgressContext() {
  const { getProgress } = useFindingsContext()
  return getProgress
}

/** Like useFinding but seeds from the shared cache immediately, then refreshes in background. */
export function useCachedFinding(id: string) {
  const { getCached, refetch: refetchAll } = useFindingsContext()

  // Seed from cache so there's no flash of loading state
  const [data, setData] = useState<Trigger | null>(() => getCached(id) ?? null)
  const [loading, setLoading] = useState(data === null)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      const finding = await fetchFinding(id)
      if (!mountedRef.current) return
      if (!finding) {
        setNotFound(true)
        setData(null)
      } else {
        setData(mapFindingToTrigger(finding))
        setNotFound(false)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load finding")
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [id])

  useEffect(() => {
    mountedRef.current = true
    // If we already have cached data, do a silent background refresh
    void load()
    const interval = window.setInterval(load, 10000)
    return () => {
      mountedRef.current = false
      window.clearInterval(interval)
    }
  }, [load])

  const refetch = useCallback(async () => {
    await load()
    await refetchAll()
  }, [load, refetchAll])

  return { data, loading, error, notFound, refetch }
}

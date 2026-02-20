"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Trigger } from "@/lib/data"
import { fetchFinding, fetchFindings, mapFindingToTrigger } from "@/lib/backend"

interface UseFindingsOptions {
  refreshMs?: number
}

interface UseFindingOptions {
  refreshMs?: number
}

export function useFindings(options: UseFindingsOptions = {}) {
  const refreshMs = options.refreshMs ?? 15000
  const [data, setData] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    try {
      setError(null)
      const findings = await fetchFindings()
      const triggers = findings.map(mapFindingToTrigger)
      if (mountedRef.current) {
        setData(triggers)
        setLoading(false)
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
    const interval = window.setInterval(load, refreshMs)
    return () => {
      mountedRef.current = false
      window.clearInterval(interval)
    }
  }, [load, refreshMs])

  return {
    data,
    loading,
    error,
    refetch: load,
  }
}

export function useFinding(resourceId: string, options: UseFindingOptions = {}) {
  const refreshMs = options.refreshMs ?? 10000
  const [data, setData] = useState<Trigger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    if (!resourceId) {
      return
    }
    try {
      setError(null)
      const finding = await fetchFinding(resourceId)
      if (!finding) {
        if (mountedRef.current) {
          setNotFound(true)
          setData(null)
          setLoading(false)
        }
        return
      }
      if (mountedRef.current) {
        setNotFound(false)
        setData(mapFindingToTrigger(finding))
        setLoading(false)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load finding")
        setLoading(false)
      }
    }
  }, [resourceId])

  useEffect(() => {
    mountedRef.current = true
    void load()
    const interval = window.setInterval(load, refreshMs)
    return () => {
      mountedRef.current = false
      window.clearInterval(interval)
    }
  }, [load, refreshMs])

  return {
    data,
    loading,
    error,
    notFound,
    refetch: load,
  }
}

/**
 * Next.js catch-all proxy → FastAPI backend (http://localhost:8000)
 * Maps /api/backend/** → http://localhost:8000/api/**
 */

import { type NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"

async function proxy(req: NextRequest, path: string[]) {
  const targetPath = "/api/" + path.join("/")
  const url = `${BACKEND}${targetPath}`

  const headers: Record<string, string> = { "Content-Type": "application/json" }

  let body: string | undefined
  if (req.method !== "GET" && req.method !== "HEAD") {
    try { body = await req.text() } catch { /* empty body */ }
  }

  const res = await fetch(url, {
    method: req.method,
    headers,
    body,
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(req, path)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  return proxy(req, path)
}

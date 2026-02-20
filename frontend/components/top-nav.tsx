"use client"

import Link from "next/link"
import { Activity } from "lucide-react"

export function TopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">
            Downscale
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Dashboard
          </Link>
          <span className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer">
            Settings
          </span>
          <span className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer">
            Docs
          </span>
        </nav>
      </div>
    </header>
  )
}

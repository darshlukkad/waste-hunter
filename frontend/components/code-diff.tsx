"use client"

import { useState } from "react"
import type { CodeChange } from "@/lib/data"
import { ChevronDown, FileCode, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CodeDiffProps {
  changes: CodeChange[]
}

function parseDiffStats(diff: string) {
  const lines = diff.split("\n")
  let additions = 0
  let deletions = 0
  for (const line of lines) {
    if (line.startsWith("+")) additions++
    else if (line.startsWith("-")) deletions++
  }
  return { additions, deletions }
}

function DiffFile({ change }: { change: CodeChange }) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const stats = parseDiffStats(change.diff)
  const lines = change.diff.split("\n")

  const handleCopy = () => {
    navigator.clipboard.writeText(change.diff)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* File header */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 bg-secondary/50 px-3 py-2 text-left transition-colors hover:bg-secondary/80"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            !open && "-rotate-90"
          )}
        />
        <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate font-mono text-xs font-medium text-foreground">
          {change.file}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {stats.additions > 0 && (
            <span className="text-[10px] font-mono font-medium text-chart-1">
              +{stats.additions}
            </span>
          )}
          {stats.deletions > 0 && (
            <span className="text-[10px] font-mono font-medium text-destructive">
              -{stats.deletions}
            </span>
          )}
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {change.language}
          </span>
        </div>
      </button>

      {/* Diff content */}
      {open && (
        <div className="relative">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-2 z-10 rounded-md border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Copy diff"
          >
            {copied ? (
              <Check className="h-3 w-3 text-chart-1" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
          <div className="overflow-x-auto bg-background">
            <table className="w-full border-collapse font-mono text-xs">
              <tbody>
                {lines.map((line, i) => {
                  const isAdd = line.startsWith("+")
                  const isDel = line.startsWith("-")
                  const isContext = !isAdd && !isDel

                  return (
                    <tr
                      key={`${change.file}-line-${i}`}
                      className={cn(
                        isAdd && "bg-chart-1/8",
                        isDel && "bg-destructive/8"
                      )}
                    >
                      <td className="w-[1px] select-none whitespace-nowrap border-r border-border px-3 py-0 text-right text-muted-foreground/40 leading-6">
                        {i + 1}
                      </td>
                      <td className="w-[1px] select-none whitespace-nowrap px-2 py-0 text-center leading-6">
                        {isAdd && (
                          <span className="text-chart-1 font-bold">+</span>
                        )}
                        {isDel && (
                          <span className="text-destructive font-bold">-</span>
                        )}
                      </td>
                      <td
                        className={cn(
                          "whitespace-pre px-2 py-0 leading-6",
                          isAdd && "text-chart-1",
                          isDel && "text-destructive",
                          isContext && "text-foreground/70"
                        )}
                      >
                        {isAdd || isDel ? line.slice(1) : line || " "}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function CodeDiff({ changes }: CodeDiffProps) {
  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
        <FileCode className="h-6 w-6 text-muted-foreground/30" />
        <p className="mt-2 text-xs text-muted-foreground">
          Code changes will appear once analysis completes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {changes.length} file{changes.length !== 1 ? "s" : ""} changed
        </p>
      </div>
      {changes.map((change) => (
        <DiffFile key={change.file} change={change} />
      ))}
    </div>
  )
}

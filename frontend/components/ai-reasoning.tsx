"use client"

import type { ReasoningStep } from "@/lib/data"
import { Bot } from "lucide-react"

interface AiReasoningProps {
  steps: ReasoningStep[]
  summary: string
}

export function AiReasoning({ steps, summary }: AiReasoningProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-sm leading-relaxed text-foreground/90 pt-0.5">
          {summary}
        </p>
      </div>

      {/* Steps - clean vertical list */}
      <div className="flex flex-col">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className="group relative flex gap-4 pb-6 last:pb-0"
          >
            {/* Vertical connector */}
            <div className="flex flex-col items-center">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="pt-0.5">
              <p className="text-sm font-medium text-foreground leading-snug">
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {step.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

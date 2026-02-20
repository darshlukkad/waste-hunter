"use client"

import type { StateEvent, TriggerStatus } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

const stateColors: Record<TriggerStatus, string> = {
  active: "bg-chart-2 text-chart-2",
  idle: "bg-warning text-warning",
  downsized: "bg-primary text-primary",
  paused: "bg-muted-foreground text-muted-foreground",
}

const stateBadgeColors: Record<TriggerStatus, string> = {
  active: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  idle: "bg-warning/15 text-warning border-warning/30",
  downsized: "bg-primary/15 text-primary border-primary/30",
  paused: "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
}

interface StateTimelineProps {
  events: StateEvent[]
  currentState: TriggerStatus
}

export function StateTimeline({ events, currentState }: StateTimelineProps) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground">
            State Manager
          </CardTitle>
          <Badge
            variant="outline"
            className={`text-[10px] font-medium px-2 py-0.5 ${stateBadgeColors[currentState]}`}
          >
            Current: {currentState.charAt(0).toUpperCase() + currentState.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6">
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          <div className="flex flex-col gap-5">
            {events.map((event, index) => (
              <div key={event.id} className="relative flex gap-3">
                <div
                  className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-background ${
                    index === 0
                      ? stateColors[event.toState].split(" ")[0]
                      : "bg-secondary"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium px-1.5 py-0 ${stateBadgeColors[event.fromState]}`}
                    >
                      {event.fromState}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {"->"}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-medium px-1.5 py-0 ${stateBadgeColors[event.toState]}`}
                    >
                      {event.toState}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.reason}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {format(new Date(event.timestamp), "MMM d, yyyy HH:mm")}
                    </span>
                    <span className="text-border">|</span>
                    <span className="font-mono">{event.actor}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

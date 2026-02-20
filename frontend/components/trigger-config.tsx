"use client"

import { useState } from "react"
import type { TriggerConfig, TriggerStatus } from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowDownToLine,
  Play,
  Pause,
  RotateCcw,
  Settings2,
} from "lucide-react"

interface TriggerConfigProps {
  config: TriggerConfig
  status: TriggerStatus
  name: string
}

export function TriggerConfigPanel({ config, status, name }: TriggerConfigProps) {
  const [idleThreshold, setIdleThreshold] = useState(config.idleThreshold)
  const [cooldown, setCooldown] = useState(config.cooldownPeriod)
  const [scaleDown, setScaleDown] = useState(config.scaleDownPercent)
  const [autoDownsize, setAutoDownsize] = useState(config.autoDownsize)

  return (
    <div className="flex flex-col gap-4">
      {/* Quick Actions */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {status !== "downsized" && status !== "paused" && (
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 border-border bg-secondary text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-xs"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
                Downsize Now
              </Button>
            )}
            {status === "paused" || status === "downsized" ? (
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 border-border bg-secondary text-foreground hover:bg-chart-2/10 hover:text-chart-2 hover:border-chart-2/30 text-xs"
              >
                <Play className="h-3.5 w-3.5" />
                Scale Up
              </Button>
            ) : null}
            {status === "active" && (
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 border-border bg-secondary text-foreground hover:bg-warning/10 hover:text-warning hover:border-warning/30 text-xs"
              >
                <Pause className="h-3.5 w-3.5" />
                Pause
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="justify-start gap-2 border-border bg-secondary text-foreground hover:bg-secondary text-xs col-span-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground">
              Configuration
            </CardTitle>
            <Badge
              variant="outline"
              className="text-[10px] font-mono text-muted-foreground border-border"
            >
              {name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Auto Downsize Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium text-foreground">
                Auto Downsize
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Automatically scale down when idle
              </p>
            </div>
            <Switch
              checked={autoDownsize}
              onCheckedChange={setAutoDownsize}
            />
          </div>

          {/* Idle Threshold */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-foreground">
                Idle Threshold
              </Label>
              <span className="text-xs font-mono text-primary">
                {idleThreshold}m
              </span>
            </div>
            <Slider
              value={[idleThreshold]}
              onValueChange={(v) => setIdleThreshold(v[0])}
              min={5}
              max={240}
              step={5}
              className="w-full"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Time before marking as idle
            </p>
          </div>

          {/* Cooldown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-foreground">
                Cooldown Period
              </Label>
              <span className="text-xs font-mono text-primary">
                {cooldown}m
              </span>
            </div>
            <Slider
              value={[cooldown]}
              onValueChange={(v) => setCooldown(v[0])}
              min={5}
              max={120}
              step={5}
              className="w-full"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Wait time before re-scaling
            </p>
          </div>

          {/* Scale Down Percent */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-foreground">
                Scale Down %
              </Label>
              <span className="text-xs font-mono text-primary">
                {scaleDown}%
              </span>
            </div>
            <Slider
              value={[scaleDown]}
              onValueChange={(v) => setScaleDown(v[0])}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              How much to reduce resources
            </p>
          </div>

          {/* Instance Limits */}
          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-secondary/50 p-3">
            <div>
              <p className="text-[10px] text-muted-foreground">
                Min Instances
              </p>
              <p className="text-sm font-mono font-medium text-foreground">
                {config.minInstances}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">
                Max Instances
              </p>
              <p className="text-sm font-mono font-medium text-foreground">
                {config.maxInstances}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
          >
            Save Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

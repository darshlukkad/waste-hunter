"use client"

import { useTheme } from "next-themes"
import { Moon, Sun, Crosshair } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function TopNav() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-background/95 px-6 backdrop-blur">
      <div className="flex items-center gap-2">
        <Crosshair className="h-4 w-4 text-foreground" />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          WasteHunter
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
        </Button>
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-secondary text-[11px] font-medium text-foreground">
            JD
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

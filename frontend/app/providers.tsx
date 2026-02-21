"use client"

import { CopilotKit } from "@copilotkit/react-core"
import "@copilotkit/react-ui/styles.css"
import { FindingsProvider } from "@/contexts/findings-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <FindingsProvider>
        {children}
      </FindingsProvider>
    </CopilotKit>
  )
}

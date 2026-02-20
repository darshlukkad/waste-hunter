import {
  CopilotRuntime,
  AnthropicAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"
import Anthropic from "@anthropic-ai/sdk"
import { NextRequest } from "next/server"

const runtime = new CopilotRuntime()

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter: new AnthropicAdapter({
      anthropic: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      model: "claude-sonnet-4-6-20251101",
    }),
    endpoint: "/api/copilotkit",
  })

  return handleRequest(req)
}

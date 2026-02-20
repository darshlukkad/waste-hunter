import {
  CopilotRuntime,
  BedrockAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"

const serviceAdapter = new BedrockAdapter({
  model: "us.anthropic.claude-3-5-haiku-20241022-v1:0",
  region: process.env.AWS_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

export const POST = async (req: Request) => {
  const runtime = new CopilotRuntime()
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  })
  return handleRequest(req)
}

import { createBullBoard } from "@bull-board/api"
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter"
import { HonoAdapter } from "@bull-board/hono"
import { isSuperAdmin } from "@chatbotx.io/business"
import {
  aiAgentQueue,
  chatQueue,
  defaultQueue,
  getSequenceSchedulerQueue,
  integrationQueue,
  quotaQueue,
  scheduleQueue,
  triggerQueue,
  webhookQueue,
} from "@chatbotx.io/worker-config"
import { serveStatic } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import { handle } from "hono/vercel"
import { getCurrentUser } from "@/lib/auth/utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const basePath = "/developer/queues"

type BullBoardQueueLike = {
  add: (...args: unknown[]) => Promise<string>
  addBulk: (...args: unknown[]) => Promise<string>
  name: string
  opts: unknown
  client: unknown
}

function isBullBoardQueue(queue: unknown): queue is BullBoardQueueLike {
  return (
    typeof queue === "object" &&
    queue !== null &&
    "add" in queue &&
    "addBulk" in queue &&
    "name" in queue &&
    "opts" in queue &&
    "client" in queue
  )
}

async function buildApp() {
  const sequenceSchedulerQueue = await getSequenceSchedulerQueue()
  const queues = [
    chatQueue,
    aiAgentQueue,
    triggerQueue,
    webhookQueue,
    defaultQueue,
    integrationQueue,
    quotaQueue,
    scheduleQueue,
    ...(sequenceSchedulerQueue ? [sequenceSchedulerQueue] : []),
  ].filter(isBullBoardQueue)

  const serverAdapter = new HonoAdapter(serveStatic)
  serverAdapter.setBasePath(basePath)

  createBullBoard({
    queues: queues.map((queue) => new BullMQAdapter(queue as never)),
    serverAdapter,
    options: { uiBasePath: "node_modules/@bull-board/ui" },
  })

  const app = new Hono()
  app.route(basePath, serverAdapter.registerPlugin())
  return app
}

async function handler(request: Request) {
  const user = await getCurrentUser()
  if (!(user && isSuperAdmin(user))) {
    return new Response("Not found", { status: 404 })
  }

  if (process.env.DISABLE_REDIS === "true" || process.env.SKIP_REDIS === "true") {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BullMQ Queues - Offline</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background-color: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .icon-box {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 24px;
    }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
    .badge {
      display: inline-block;
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">⚡</div>
    <span class="badge">Redis Queues Disabled</span>
    <h1>Queue Monitoring Offline</h1>
    <p>Redis background queues are currently disabled (<code>DISABLE_REDIS=true</code>). The main application and control panel are running normally.</p>
  </div>
</body>
</html>`
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }

  const app = await buildApp()
  return handle(app)(request)
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler

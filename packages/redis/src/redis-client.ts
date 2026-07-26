import logger from "@chatbotx.io/logger"
import { Redis, type RedisOptions } from "ioredis"

function createMockRedisClient(): Redis {
  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (
        prop === "on" ||
        prop === "once" ||
        prop === "off" ||
        prop === "addListener" ||
        prop === "removeListener"
      ) {
        return () => target
      }
      if (prop === "status") return "ready"
      if (prop === "connect" || prop === "quit" || prop === "disconnect") {
        return async () => {}
      }
      if (prop === "then") return undefined
      return async () => null
    },
  }
  return new Proxy({}, handler) as unknown as Redis
}

export function createRedisConnection(
  url: string,
  options: Partial<RedisOptions> = {},
): Redis {
  if (process.env.DISABLE_REDIS === "true" || process.env.SKIP_REDIS === "true") {
    logger.info("Redis is disabled via env variable; returning mock client")
    return createMockRedisClient()
  }

  const config: Partial<RedisOptions> = {
    maxRetriesPerRequest: null,
    keepAlive: 5000,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    family: 4,
    ...options,
  }

  const connection = new Redis(url, config)

  connection.on("error", (err) => {
    logger.warn({ err }, "Redis connection warning (offline)")
  })

  return connection
}

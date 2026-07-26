import logger from "@chatbotx.io/logger"
import { Redis, type RedisOptions } from "ioredis"

export function createRedisConnection(
  url: string,
  options: Partial<RedisOptions> = {},
): Redis {
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

  // A shared, long-lived ioredis client emits 'error' on socket-level failures.
  // Suppress uncaught AggregateError events so process does not crash when Redis is offline.
  connection.on("error", (err) => {
    logger.warn({ err }, "Redis connection warning (offline)")
  })

  return connection
}

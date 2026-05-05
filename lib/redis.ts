import { Redis } from "@upstash/redis";

/**
 * Upstash Redis 单例客户端
 *
 * 使用 HTTP REST API，Edge Runtime 和 Node.js 运行时均兼容。
 * 若环境变量未配置（本地开发或 CI），客户端仍可构造但调用会抛出错误；
 * 调用方应做 try/catch，降级到无缓存/无限流。
 */
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "[redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set"
      );
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

/** 检查 Redis 是否已配置（用于条件降级） */
export function isRedisConfigured(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

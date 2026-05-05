/**
 * 热路径 Redis 缓存层
 *
 * 为首页等高频读取路径提供 Redis 缓存，降低 DB 查询压力。
 * 若 Redis 未配置或不可用，自动降级为直接调用原始函数。
 *
 * 缓存策略：
 *   - homepage:latest:{limit}    → TTL 5 分钟（首页最新项目列表）
 *   - homepage:featured:{limit}  → TTL 10 分钟（首页精选项目列表）
 */

import { isRedisConfigured, getRedis } from "@/lib/redis";
import {
  fetchHomepageLatestProjects,
  fetchHomepageFeaturedProjects,
  type ProjectListItem,
} from "@/lib/project-list";

const TTL_LATEST_S = 5 * 60; // 5 分钟
const TTL_FEATURED_S = 10 * 60; // 10 分钟

// ─── 泛型缓存工具 ─────────────────────────────────────────────────────────────

async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fallback: () => Promise<T>,
): Promise<T> {
  if (!isRedisConfigured()) {
    return fallback();
  }

  try {
    const redis = getRedis();
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await fallback();
    // 异步写入缓存，不阻塞响应
    redis.set(key, fresh, { ex: ttlSeconds }).catch((err) => {
      console.error("[project-cache] Redis set failed:", err);
    });
    return fresh;
  } catch (err) {
    // Redis 故障降级
    console.error("[project-cache] Redis error, falling back to DB:", err);
    return fallback();
  }
}

// ─── 缓存包装函数 ─────────────────────────────────────────────────────────────

/**
 * 首页最新项目（带 Redis 缓存）
 */
export async function getCachedHomepageLatestProjects(
  limit = 6,
): Promise<ProjectListItem[]> {
  return withCache(
    `homepage:latest:${limit}`,
    TTL_LATEST_S,
    () => fetchHomepageLatestProjects(limit),
  );
}

/**
 * 首页精选项目（带 Redis 缓存）
 */
export async function getCachedHomepageFeaturedProjects(
  limit = 6,
): Promise<ProjectListItem[]> {
  return withCache(
    `homepage:featured:${limit}`,
    TTL_FEATURED_S,
    () => fetchHomepageFeaturedProjects(limit),
  );
}

// ─── 缓存失效工具 ─────────────────────────────────────────────────────────────

/**
 * 手动使首页缓存失效（项目发布/更新时调用）
 * limit 默认值须与调用 getCached* 时一致。
 */
export async function invalidateHomepageCache(limit = 6): Promise<void> {
  if (!isRedisConfigured()) return;

  try {
    const redis = getRedis();
    await Promise.all([
      redis.del(`homepage:latest:${limit}`),
      redis.del(`homepage:featured:${limit}`),
    ]);
  } catch (err) {
    console.error("[project-cache] invalidateHomepageCache failed:", err);
  }
}

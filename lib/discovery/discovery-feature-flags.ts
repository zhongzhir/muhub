/**
 * Vertical Discovery feature flags — env 控制，支持回滚。
 */

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) {
    return defaultValue;
  }
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** 总开关：Vertical Discovery scope 读写与推断 */
export function isVerticalDiscoveryEnabled(): boolean {
  return envFlag("VERTICAL_DISCOVERY_ENABLED", true);
}

/** Phase 2：RSS 模式接入 run-discovery-source */
export function isVerticalDiscoveryRssEnabled(): boolean {
  if (!isVerticalDiscoveryEnabled()) {
    return false;
  }
  return envFlag("VERTICAL_DISCOVERY_RSS_ENABLED", true);
}

/** Phase 2：批量跑 publishing_ai 来源 */
export function isPublishingDiscoveryPipelineEnabled(): boolean {
  if (!isVerticalDiscoveryEnabled()) {
    return false;
  }
  return envFlag("VERTICAL_DISCOVERY_PUBLISHING_PIPELINE", true);
}

/** Phase 2：RSS 条目关键词过滤（出版+AI 相关） */
export function isPublishingRssContentFilterEnabled(): boolean {
  return envFlag("VERTICAL_DISCOVERY_PUBLISHING_RSS_FILTER", true);
}

/** Phase 4：training 动态项目流（预留） */
export function getTrainingProjectsMode(): "static" | "live" {
  const raw = process.env.TRAINING_PROJECTS_MODE?.trim().toLowerCase();
  return raw === "live" ? "live" : "static";
}

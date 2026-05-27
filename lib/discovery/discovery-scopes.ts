/**
 * Vertical Discovery scope 常量与校验。
 * scope 驱动「从哪些来源发现、在哪个入口展示」，与 primaryCategory 并存。
 */

export const DISCOVERY_SCOPES = [
  "general",
  "publishing_ai",
  "education_ai",
  "media_ai",
] as const;

export type DiscoveryScope = (typeof DISCOVERY_SCOPES)[number];

export const DEFAULT_DISCOVERY_SCOPES: DiscoveryScope[] = ["general"];

export function isDiscoveryScope(value: string): value is DiscoveryScope {
  return (DISCOVERY_SCOPES as readonly string[]).includes(value);
}

export function normalizeDiscoveryScopes(input: unknown): DiscoveryScope[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_DISCOVERY_SCOPES];
  }
  const out: DiscoveryScope[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") {
      continue;
    }
    const trimmed = item.trim();
    if (!isDiscoveryScope(trimmed) || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.length > 0 ? out : [...DEFAULT_DISCOVERY_SCOPES];
}

export function mergeDiscoveryScopes(...groups: unknown[]): DiscoveryScope[] {
  const merged: DiscoveryScope[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const scope of normalizeDiscoveryScopes(group)) {
      if (seen.has(scope)) {
        continue;
      }
      seen.add(scope);
      merged.push(scope);
    }
  }
  return merged.length > 0 ? merged : [...DEFAULT_DISCOVERY_SCOPES];
}

export function projectHasDiscoveryScope(
  scopes: unknown,
  target: DiscoveryScope,
): boolean {
  return normalizeDiscoveryScopes(scopes).includes(target);
}

/** 兼容旧 configJson.industry 字段 */
export function scopesFromLegacyIndustry(industry: unknown): DiscoveryScope[] {
  if (typeof industry !== "string" || !industry.trim()) {
    return [];
  }
  const key = industry.trim().toLowerCase();
  if (key === "publishing") {
    return ["publishing_ai"];
  }
  if (key === "education") {
    return ["education_ai"];
  }
  if (key === "media" || key === "media_ai") {
    return ["media_ai"];
  }
  return [];
}

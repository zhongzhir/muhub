/**
 * 实体名称规范化 — E1 轻量去重用
 */

export function normalizeEntityName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[「」『』""''()（）[\]【】《》<>]/g, "")
    .replace(/[·•·]/g, "")
    .slice(0, 200);
}

export function buildEntityHintDedupeKey(input: {
  sourceSignalId: string | null | undefined;
  normalizedName: string;
  discoveryScopes: string[];
}): string {
  const signalPart = input.sourceSignalId?.trim() || "_nosignal_";
  const scopesPart = [...input.discoveryScopes].sort().join("|") || "general";
  return `${signalPart}:${input.normalizedName}:${scopesPart}`;
}

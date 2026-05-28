/**
 * WEBSITE_SCAN Signal metadataJson 解析（Admin 展示用）
 */

export type WebsiteScanSignalMeta = {
  pageUrl: string;
  title: string;
  snippet: string;
  matchedKeywords: string[];
  depth: number | null;
  parentUrl: string | null;
  sourceKey: string | null;
  confidence: number | null;
  reason: string | null;
  scanMode: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

export function parseWebsiteScanSignalMetadata(
  metadataJson: unknown,
  options?: { signalType?: string; url?: string; title?: string; summary?: string | null },
): WebsiteScanSignalMeta | null {
  const isScanType = options?.signalType === "WEBSITE_SCAN";
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    if (!isScanType) {
      return null;
    }
    return {
      pageUrl: options?.url ?? "",
      title: options?.title ?? "",
      snippet: options?.summary ?? "",
      matchedKeywords: [],
      depth: null,
      parentUrl: null,
      sourceKey: null,
      confidence: null,
      reason: null,
      scanMode: "website_scan",
    };
  }
  const meta = metadataJson as Record<string, unknown>;
  if (!isScanType && meta.scanMode !== "website_scan" && meta.mode !== "website_scan") {
    return null;
  }

  const matchedRaw = meta.matchedKeywords;
  const matchedKeywords = Array.isArray(matchedRaw)
    ? matchedRaw.filter((k): k is string => typeof k === "string" && k.trim().length > 0)
    : [];

  return {
    pageUrl: asString(meta.pageUrl) ?? options?.url ?? "",
    title: asString(meta.title) ?? options?.title ?? "",
    snippet: asString(meta.snippet) ?? options?.summary ?? "",
    matchedKeywords,
    depth: asNumber(meta.depth),
    parentUrl: asString(meta.parentUrl),
    sourceKey: asString(meta.sourceKey),
    confidence: asNumber(meta.confidence),
    reason: asString(meta.reason),
    scanMode: asString(meta.scanMode) ?? "website_scan",
  };
}

export function isWebsiteScanSignal(signalType: string, metadataJson: unknown): boolean {
  if (signalType === "WEBSITE_SCAN") {
    return true;
  }
  return parseWebsiteScanSignalMetadata(metadataJson) !== null;
}

export function truncateSnippet(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max)}…`;
}

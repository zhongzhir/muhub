import { mergeDiscoveryScopes, type DiscoveryScope } from "@/lib/discovery/discovery-scopes";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import {
  WEBSITE_SCAN_DEFAULTS,
  type WebsiteScanConfig,
} from "@/lib/discovery/website-scan/types";

function splitList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function parseWebsiteScanConfig(
  configJson: unknown,
  sourceKey?: string,
): WebsiteScanConfig | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return null;
  }
  const cfg = configJson as Record<string, unknown>;
  if (cfg.mode !== "website_scan") {
    return null;
  }

  const startFromArray = splitList(cfg.startUrls);
  const startFromUrl = typeof cfg.url === "string" && cfg.url.trim() ? [cfg.url.trim()] : [];
  const startUrls = [...new Set([...startFromArray, ...startFromUrl])];
  if (startUrls.length === 0) {
    return null;
  }

  const allowedDomains = splitList(cfg.allowedDomains);
  if (allowedDomains.length === 0) {
    for (const u of startUrls) {
      try {
        allowedDomains.push(new URL(u).hostname.toLowerCase());
      } catch {
        /* skip */
      }
    }
  }

  const scopes = mergeDiscoveryScopes(parseScopesFromConfigJson(configJson)) as DiscoveryScope[];

  return {
    mode: "website_scan",
    startUrls,
    allowedDomains: allowedDomains.map((d) => d.toLowerCase()),
    maxDepth: clampInt(cfg.maxDepth, WEBSITE_SCAN_DEFAULTS.maxDepth, 0, 5),
    maxPages: clampInt(cfg.maxPages, WEBSITE_SCAN_DEFAULTS.maxPages, 1, 200),
    includeKeywords: splitList(cfg.includeKeywords),
    excludePatterns: splitList(cfg.excludePatterns).map((p) => p.toLowerCase()),
    scopes: scopes.length > 0 ? scopes : ["publishing_ai"],
  };
}

export function hostnameAllowed(hostname: string, allowedDomains: string[]): boolean {
  const host = hostname.toLowerCase();
  return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
}

export function urlExcluded(url: string, excludePatterns: string[]): boolean {
  if (excludePatterns.length === 0) {
    return false;
  }
  let pathAndQuery: string;
  try {
    const u = new URL(url);
    pathAndQuery = `${u.pathname}${u.search}`.toLowerCase();
  } catch {
    pathAndQuery = url.toLowerCase();
  }
  return excludePatterns.some((p) => p && pathAndQuery.includes(p.toLowerCase()));
}

export function urlHasSkippedExtension(url: string): boolean {
  const path = url.split("?")[0]!.toLowerCase();
  return (
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".png") ||
    path.endsWith(".gif") ||
    path.endsWith(".webp") ||
    path.endsWith(".svg") ||
    path.endsWith(".pdf") ||
    path.endsWith(".zip") ||
    path.endsWith(".doc") ||
    path.endsWith(".docx") ||
    path.endsWith(".xls") ||
    path.endsWith(".xlsx") ||
    path.endsWith(".ppt") ||
    path.endsWith(".pptx") ||
    path.endsWith(".mp4") ||
    path.endsWith(".avi") ||
    path.endsWith(".mov") ||
    path.endsWith(".mp3") ||
    path.endsWith(".apk")
  );
}

export function normalizeScanUrl(raw: string, base?: string): string | null {
  try {
    const u = base ? new URL(raw, base) : new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return null;
    }
    u.hash = "";
    return u.href;
  } catch {
    return null;
  }
}

import type { DiscoverySourceStatus, DiscoverySourceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseSourceKind,
  parseSourceOwner,
  slugifySourceKey,
  sourceUrlFromConfig,
  type SourceKind,
  type SourceOwner,
} from "@/lib/discovery/source-network/source-kinds";
import { mergeDiscoveryScopes, type DiscoveryScope } from "@/lib/discovery/discovery-scopes";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";

export type CreateDiscoverySourceInput = {
  name: string;
  key?: string;
  url: string;
  sourceKind: SourceKind;
  type?: DiscoverySourceType;
  scopes?: DiscoveryScope[];
  status?: DiscoverySourceStatus;
  sourceOwner?: SourceOwner;
  notes?: string | null;
  /** GITHUB_TOPIC 专用 */
  topics?: string[];
  /** WEBSITE_SCAN 专用 */
  startUrls?: string[];
  allowedDomains?: string[];
  maxDepth?: number;
  maxPages?: number;
  includeKeywords?: string[];
  excludePatterns?: string[];
};

function mapKindToPrismaType(kind: SourceKind): DiscoverySourceType {
  if (kind === "GITHUB_TOPIC") {
    return "GITHUB";
  }
  if (kind === "RSS") {
    return "NEWS";
  }
  if (kind === "WEBSITE") {
    return "INSTITUTION";
  }
  if (kind === "WEBSITE_SCAN") {
    return "INSTITUTION";
  }
  if (kind === "WECHAT") {
    return "SOCIAL";
  }
  return "BLOG";
}

export function buildConfigJsonFromInput(input: CreateDiscoverySourceInput): Record<string, unknown> {
  const scopes = mergeDiscoveryScopes(input.scopes ?? ["publishing_ai"]);
  const base: Record<string, unknown> = {
    sourceKind: input.sourceKind,
    sourceOwner: input.sourceOwner ?? "manual",
    scopes,
    industry: "publishing",
    url: input.url.trim(),
  };

  if (input.sourceKind === "RSS") {
    base.mode = "rss";
    base.filterMode = "relaxed";
    base.requireAiHint = false;
  } else if (input.sourceKind === "GITHUB_TOPIC") {
    base.mode = "github_topic";
    base.topics = input.topics?.length ? input.topics : ["publishing"];
    base.perPage = 25;
    base.sort = "updated";
  } else if (input.sourceKind === "WEBSITE") {
    base.mode = "website_list";
  } else if (input.sourceKind === "WEBSITE_SCAN") {
    base.mode = "website_scan";
    const starts = input.startUrls?.length ? input.startUrls : [input.url.trim()];
    base.startUrls = starts;
    base.url = starts[0] ?? input.url.trim();
    base.allowedDomains = input.allowedDomains?.length
      ? input.allowedDomains
      : starts
          .map((u) => {
            try {
              return new URL(u).hostname;
            } catch {
              return null;
            }
          })
          .filter(Boolean);
    base.maxDepth = input.maxDepth ?? 2;
    base.maxPages = input.maxPages ?? 50;
    base.includeKeywords = input.includeKeywords?.length
      ? input.includeKeywords
      : ["AI", "人工智能", "出版"];
    base.excludePatterns = input.excludePatterns?.length
      ? input.excludePatterns
      : ["login", "search", "comment"];
  }

  return base;
}

export async function createDiscoverySourceRecord(
  input: CreateDiscoverySourceInput,
): Promise<{ id: string; key: string }> {
  const key =
    input.key?.trim() ||
    `manual-${slugifySourceKey(input.name)}-${Date.now().toString(36).slice(-4)}`;
  const type = input.type ?? mapKindToPrismaType(input.sourceKind);
  const configJson = buildConfigJsonFromInput(input);

  const row = await prisma.discoverySource.create({
    data: {
      key,
      name: input.name.trim(),
      type,
      subtype:
        input.sourceKind === "GITHUB_TOPIC"
          ? "topic"
          : input.sourceKind === "WEBSITE_SCAN"
            ? "website_scan"
            : "publishing_manual",
      status: input.status ?? "TESTING",
      notes: input.notes?.trim() || null,
      configJson: configJson as Prisma.InputJsonValue,
    },
    select: { id: true, key: true },
  });

  return row;
}

const WEBSITE_SCAN_COPY_DEFAULTS = {
  maxDepth: 2,
  maxPages: 50,
  includeKeywords: ["AI", "人工智能", "大模型", "数字出版", "AIGC"],
  excludePatterns: ["login", "comment"],
} as const;

/** 从旧 WEBSITE 来源复制为新 WEBSITE_SCAN 来源（不修改原来源） */
export async function copyDiscoverySourceAsWebsiteScan(
  sourceId: string,
): Promise<{ id: string; key: string }> {
  const existing = await prisma.discoverySource.findUnique({ where: { id: sourceId } });
  if (!existing) {
    throw new Error("来源不存在");
  }

  const kind = parseSourceKind(existing.configJson);
  if (kind === "WEBSITE_SCAN") {
    throw new Error("已是 WEBSITE_SCAN 来源");
  }
  if (kind !== "WEBSITE") {
    throw new Error("仅支持从 WEBSITE 类型来源复制");
  }

  const url = sourceUrlFromConfig(existing.configJson);
  if (!url) {
    throw new Error("原来源缺少 URL");
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error("原 URL 无效");
  }

  const scopes = parseScopesFromConfigJson(existing.configJson);
  const sourceOwner = parseSourceOwner(existing.configJson);
  const copyNote = `由来源 ${existing.key} 复制为 WEBSITE_SCAN`;
  const notes = existing.notes?.trim()
    ? `${existing.notes.trim()}\n${copyNote}`
    : copyNote;

  return createDiscoverySourceRecord({
    name: existing.name.trim(),
    url,
    sourceKind: "WEBSITE_SCAN",
    status: "TESTING",
    notes,
    sourceOwner,
    scopes: scopes.length > 0 ? scopes : ["publishing_ai"],
    startUrls: [url],
    allowedDomains: [hostname],
    maxDepth: WEBSITE_SCAN_COPY_DEFAULTS.maxDepth,
    maxPages: WEBSITE_SCAN_COPY_DEFAULTS.maxPages,
    includeKeywords: [...WEBSITE_SCAN_COPY_DEFAULTS.includeKeywords],
    excludePatterns: [...WEBSITE_SCAN_COPY_DEFAULTS.excludePatterns],
  });
}

export async function updateDiscoverySourceRecord(
  id: string,
  patch: {
    name?: string;
    status?: DiscoverySourceStatus;
    notes?: string | null;
    url?: string;
    scopes?: DiscoveryScope[];
    sourceOwner?: SourceOwner;
    /** WEBSITE_SCAN 专用；仅当 configJson.mode=website_scan 时合并 */
    websiteScan?: {
      allowedDomains?: string[];
      maxDepth?: number;
      maxPages?: number;
      includeKeywords?: string[];
      excludePatterns?: string[];
    };
  },
): Promise<void> {
  const existing = await prisma.discoverySource.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("来源不存在");
  }

  const prev =
    existing.configJson && typeof existing.configJson === "object" && !Array.isArray(existing.configJson)
      ? { ...(existing.configJson as Record<string, unknown>) }
      : {};

  const isWebsiteScan =
    prev.mode === "website_scan" || parseSourceKind(prev) === "WEBSITE_SCAN";

  if (patch.url?.trim()) {
    const url = patch.url.trim();
    prev.url = url;
    if (isWebsiteScan) {
      const existingStarts = Array.isArray(prev.startUrls)
        ? (prev.startUrls as unknown[]).filter(
            (u): u is string => typeof u === "string" && u.trim().length > 0,
          )
        : [];
      prev.startUrls = existingStarts.length > 0 ? [url, ...existingStarts.slice(1)] : [url];
    }
  }
  if (patch.scopes?.length) {
    prev.scopes = mergeDiscoveryScopes(patch.scopes);
  }
  if (patch.sourceOwner) {
    prev.sourceOwner = patch.sourceOwner;
  }

  if (isWebsiteScan && patch.websiteScan) {
    const ws = patch.websiteScan;
    if (ws.allowedDomains !== undefined) {
      prev.allowedDomains = ws.allowedDomains;
    }
    if (ws.maxDepth !== undefined && Number.isFinite(ws.maxDepth)) {
      prev.maxDepth = Math.min(5, Math.max(0, Math.floor(ws.maxDepth)));
    }
    if (ws.maxPages !== undefined && Number.isFinite(ws.maxPages)) {
      prev.maxPages = Math.min(200, Math.max(1, Math.floor(ws.maxPages)));
    }
    if (ws.includeKeywords !== undefined) {
      prev.includeKeywords = ws.includeKeywords;
    }
    if (ws.excludePatterns !== undefined) {
      prev.excludePatterns = ws.excludePatterns;
    }
    console.info("[source:update:website_scan]", JSON.stringify(prev));
  }

  await prisma.discoverySource.update({
    where: { id },
    data: {
      ...(patch.name ? { name: patch.name.trim() } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      configJson: prev as Prisma.InputJsonValue,
    },
  });
}

export function describeSourceKind(configJson: unknown): SourceKind {
  return parseSourceKind(configJson);
}

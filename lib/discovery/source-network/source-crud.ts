import type { DiscoverySourceStatus, DiscoverySourceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseSourceKind,
  slugifySourceKey,
  type SourceKind,
  type SourceOwner,
} from "@/lib/discovery/source-network/source-kinds";
import { mergeDiscoveryScopes, type DiscoveryScope } from "@/lib/discovery/discovery-scopes";

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
      subtype: input.sourceKind === "GITHUB_TOPIC" ? "topic" : "publishing_manual",
      status: input.status ?? "TESTING",
      notes: input.notes?.trim() || null,
      configJson: configJson as Prisma.InputJsonValue,
    },
    select: { id: true, key: true },
  });

  return row;
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

  if (patch.url?.trim()) {
    prev.url = patch.url.trim();
  }
  if (patch.scopes?.length) {
    prev.scopes = mergeDiscoveryScopes(patch.scopes);
  }
  if (patch.sourceOwner) {
    prev.sourceOwner = patch.sourceOwner;
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

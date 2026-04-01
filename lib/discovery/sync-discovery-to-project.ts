import type { DiscoveryCandidate, Prisma } from "@prisma/client";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { tagsFromJson } from "@/lib/discovery/score-candidate";

export const DISCOVERY_ENRICHMENT_LINK_SOURCE = "discovery_enrichment";

const ENRICHMENT_PLATFORMS = new Set([
  "website",
  "github",
  "docs",
  "twitter",
  "youtube",
  "discord",
  "blog",
  "telegram",
]);

const PLATFORM_LABEL: Record<string, string> = {
  website: "Website",
  github: "GitHub",
  docs: "Docs",
  twitter: "X / Twitter",
  youtube: "YouTube",
  discord: "Discord",
  blog: "Blog",
  telegram: "Telegram",
};

export function classificationAcceptedOnCandidate(classificationStatus: string): boolean {
  return classificationStatus === "ACCEPTED";
}

export function stringArrayFromJson(j: unknown): string[] {
  if (!Array.isArray(j)) {
    return [];
  }
  return j
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function mergeUniquePrefixed(base: string[], add: string[]): string[] {
  const seen = new Set(base.map((t) => t.toLowerCase()));
  const out = [...base];
  for (const t of add) {
    const k = t.trim();
    if (!k) {
      continue;
    }
    const lk = k.toLowerCase();
    if (seen.has(lk)) {
      continue;
    }
    seen.add(lk);
    out.push(k);
  }
  return out;
}

/**
 * 不强行把项目的 false 改为 true；仅在未设置时用候选填充。
 */
export function mergeDiscoveryBoolField(
  projectVal: boolean | null | undefined,
  candVal: boolean | null | undefined,
): boolean | null {
  if (candVal === null || candVal === undefined) {
    return projectVal ?? null;
  }
  if (projectVal === true) {
    return true;
  }
  if (projectVal === false && candVal === true) {
    return false;
  }
  if (projectVal === null || projectVal === undefined) {
    return candVal;
  }
  return projectVal;
}

type LinkSpec = {
  platform: string;
  url: string;
  label?: string | null;
  isPrimary?: boolean;
};

function safeUrl(href: string | null | undefined): string | null {
  if (!href?.trim()) {
    return null;
  }
  try {
    return new URL(href.trim()).href;
  } catch {
    return null;
  }
}

/** 候选已确认字段（不含 enrichment 建议链接） */
export function buildCoreCandidateLinkSpecs(
  cand: Pick<
    DiscoveryCandidate,
    | "repoUrl"
    | "website"
    | "docsUrl"
    | "twitterUrl"
    | "youtubeUrl"
    | "externalUrl"
    | "externalType"
  >,
): LinkSpec[] {
  const specs: LinkSpec[] = [];

  if (cand.repoUrl?.trim()) {
    try {
      specs.push({
        platform: "github",
        url: normalizeGithubRepoUrl(cand.repoUrl),
        isPrimary: true,
        label: "GitHub",
      });
    } catch {
      specs.push({ platform: "github", url: cand.repoUrl.trim(), isPrimary: true, label: "GitHub" });
    }
  }

  const websiteUrl = safeUrl(cand.website);
  if (websiteUrl) {
    specs.push({ platform: "website", url: websiteUrl, label: "Website" });
  }
  const docsUrl = safeUrl(cand.docsUrl);
  if (docsUrl) {
    specs.push({ platform: "docs", url: docsUrl, label: "Docs" });
  }
  const twitterUrl = safeUrl(cand.twitterUrl);
  if (twitterUrl) {
    specs.push({ platform: "twitter", url: twitterUrl, label: "X / Twitter" });
  }
  const youtubeUrl = safeUrl(cand.youtubeUrl);
  if (youtubeUrl) {
    specs.push({ platform: "youtube", url: youtubeUrl, label: "YouTube" });
  }

  if (
    cand.externalType === "producthunt_product" &&
    cand.externalUrl?.trim() &&
    safeUrl(cand.externalUrl)
  ) {
    specs.push({
      platform: "producthunt",
      url: safeUrl(cand.externalUrl)!,
      label: "Product Hunt",
    });
  }

  return specs;
}

/** 仅 isAccepted 的 enrichment 行；source 由调用方设为 discovery_enrichment */
export function buildAcceptedEnrichmentLinkSpecs(
  links: { platform: string; url: string; isAccepted: boolean }[] | undefined,
): LinkSpec[] {
  const specs: LinkSpec[] = [];
  for (const L of links ?? []) {
    if (!L.isAccepted) {
      continue;
    }
    const p = L.platform.toLowerCase().trim();
    if (!ENRICHMENT_PLATFORMS.has(p)) {
      continue;
    }
    const u = safeUrl(L.url);
    if (!u) {
      continue;
    }
    specs.push({
      platform: p,
      url: u,
      label: PLATFORM_LABEL[p] ?? p,
      isPrimary: false,
    });
  }
  return specs;
}

export function projectCreateClassificationSlice(
  cand: Pick<
    DiscoveryCandidate,
    | "categoriesJson"
    | "classificationStatus"
    | "isAiRelated"
    | "isChineseTool"
  >,
): {
  categoriesJson?: Prisma.InputJsonValue;
  primaryCategory?: string | null;
  isAiRelated?: boolean | null;
  isChineseTool?: boolean | null;
} {
  if (!classificationAcceptedOnCandidate(cand.classificationStatus)) {
    return {};
  }
  const cats = stringArrayFromJson(cand.categoriesJson);
  return {
    ...(cats.length ? { categoriesJson: cats as unknown as Prisma.InputJsonValue } : {}),
    primaryCategory: cats[0] ?? null,
    isAiRelated: cand.isAiRelated ?? null,
    isChineseTool: cand.isChineseTool ?? null,
  };
}

export function mergedCategoriesForProjectUpdate(
  existingJson: unknown,
  cand: Pick<DiscoveryCandidate, "categoriesJson" | "classificationStatus">,
): string[] {
  const base = stringArrayFromJson(existingJson);
  if (!classificationAcceptedOnCandidate(cand.classificationStatus)) {
    return base;
  }
  return mergeUniquePrefixed(base, stringArrayFromJson(cand.categoriesJson));
}

/** 合并后用于回填 primaryCategory（仅当项目尚无 primaryCategory） */
export function primaryFromCategories(cats: string[]): string | null {
  return cats[0] ?? null;
}

export function mergedTagsForProject(
  projectTags: string[],
  cand: Pick<DiscoveryCandidate, "tagsJson">,
): string[] {
  return mergeUniquePrefixed(projectTags, tagsFromJson(cand.tagsJson));
}

import type {
  ProjectSourceKind,
  SourceEntityAccuracy,
  SourceOwnershipLevel,
  SourceTrustLevel,
  SourceVerificationStatus,
  SourceVisibility,
} from "@prisma/client";

import { normalizeGithubRepoUrlOrNull } from "@/lib/discovery/normalize-url";
import { parseProjectSourceUrl } from "@/lib/project-source-url";

export type ProjectSourceQuality = {
  trustLevel: SourceTrustLevel;
  ownershipLevel: SourceOwnershipLevel;
  entityAccuracy: SourceEntityAccuracy;
  visibility: SourceVisibility;
  verificationStatus: SourceVerificationStatus;
  sourceCandidateScore: number;
};

export type SourceQualityOrigin = "import" | "enrichment" | "manual" | "curated";

export type SourceCandidateScoreInput = {
  url: string;
  kind: ProjectSourceKind;
  label?: string | null;
  projectWebsiteHost?: string | null;
  projectName?: string | null;
  anchorText?: string | null;
};

export const PUBLIC_SOURCE_LIMIT = 8;
export const MIN_PUBLIC_SOURCE_SCORE = 58;

const BLACKLIST_PATH_PATTERNS = [
  /\/login(?:\/|$)/i,
  /\/signup(?:\/|$)/i,
  /\/sign-up(?:\/|$)/i,
  /\/register(?:\/|$)/i,
  /\/search(?:\/|$|\?)/i,
  /\/explore(?:\/|$)/i,
  /\/tag(?:\/|$)/i,
  /\/tags(?:\/|$)/i,
  /\/category(?:\/|$)/i,
  /\/categories(?:\/|$)/i,
  /\/home(?:\/|$)/i,
  /\/feed(?:\/|$)/i,
  /\/intent\//i,
  /\/privacy(?:\/|$)/i,
  /\/terms(?:\/|$)/i,
  /\/cookie(?:\/|$)/i,
  /\/legal(?:\/|$)/i,
];

const FOOTER_HINTS = [
  "footer",
  "copyright",
  "all rights reserved",
  "备案",
  "privacy policy",
  "terms of service",
];

function plainHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function pathSegments(url: string): string[] {
  try {
    return new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return [];
  }
}

function pathnameLower(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function registrableDomain(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) {
    return host;
  }
  return parts.slice(-2).join(".");
}

function isSameRegistrableDomain(a: string, b: string): boolean {
  return registrableDomain(a) === registrableDomain(b);
}

export function isBlacklistedPublicSourceUrl(url: string): boolean {
  const host = plainHost(url);
  const path = pathnameLower(url);
  if (!host) {
    return true;
  }
  if (BLACKLIST_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
    return true;
  }
  if (host === "github.com" && pathSegments(url).length < 2) {
    return true;
  }
  if ((host === "twitter.com" || host === "x.com") && (pathSegments(url).length === 0 || path.startsWith("/home"))) {
    return true;
  }
  if (host === "youtube.com" || host === "youtu.be") {
    if (pathSegments(url).length === 0 || path === "/") {
      return true;
    }
  }
  if (host === "bilibili.com" && !path.includes("/video/")) {
    return true;
  }
  if (host === "zhihu.com" && pathSegments(url).length < 2) {
    return true;
  }
  if (host === "producthunt.com" && pathSegments(url).length === 0) {
    return true;
  }
  return false;
}

export function isPlatformHomepage(url: string): boolean {
  return isBlacklistedPublicSourceUrl(url);
}

function isExactEntityPage(url: string, kind: ProjectSourceKind): boolean {
  if (isBlacklistedPublicSourceUrl(url)) {
    return false;
  }
  if (kind === "GITHUB" || kind === "GITEE") {
    return Boolean(normalizeGithubRepoUrlOrNull(url));
  }
  if (kind === "WEBSITE" || kind === "DOCS" || kind === "BLOG") {
    return pathSegments(url).length >= 1 || Boolean(plainHost(url));
  }
  const parsed = parseProjectSourceUrl(url);
  if (parsed?.type === "PRODUCTHUNT") {
    return url.includes("/products/") || url.includes("/posts/");
  }
  if (url.includes("apps.apple.com") && url.includes("/app/")) {
    return true;
  }
  if (url.includes("play.google.com/store/apps/details")) {
    return true;
  }
  if (url.includes("chromewebstore.google.com/detail/")) {
    return true;
  }
  if (kind === "TWITTER" || kind === "BILIBILI" || kind === "ZHIHU" || kind === "XIAOHONGSHU") {
    return pathSegments(url).length >= 1;
  }
  if (kind === "OTHER") {
    return pathSegments(url).length >= 1;
  }
  return pathSegments(url).length >= 1;
}

export function sourceCandidateScore(input: SourceCandidateScoreInput): number {
  const url = input.url.trim();
  const host = plainHost(url);
  const segments = pathSegments(url);
  if (!host || isBlacklistedPublicSourceUrl(url)) {
    return 0;
  }

  let score = 0;

  // domain match (0-25)
  if (input.projectWebsiteHost && isSameRegistrableDomain(host, input.projectWebsiteHost)) {
    score += 25;
  } else if (input.kind === "GITHUB" || input.kind === "GITEE") {
    score += 18;
  } else if (url.includes("apps.apple.com") || url.includes("chromewebstore.google.com") || url.includes("producthunt.com")) {
    score += 16;
  } else {
    score += 6;
  }

  // entity match (0-25)
  if (isExactEntityPage(url, input.kind)) {
    score += 25;
  } else if (segments.length >= 2) {
    score += 10;
  }

  // path depth (0-15)
  score += Math.min(15, segments.length * 4);

  // anchor semantics (0-15)
  const label = input.label?.toLowerCase() ?? "";
  const anchor = input.anchorText?.toLowerCase() ?? "";
  const path = pathnameLower(url);
  if (label.includes("github") || label.includes("docs") || label.includes("app_store")) {
    score += 12;
  } else if (path.includes("/docs") || path.includes("/documentation")) {
    score += 10;
  } else if (anchor.includes("github") || anchor.includes("docs") || anchor.includes("download")) {
    score += 8;
  } else if (FOOTER_HINTS.some((hint) => anchor.includes(hint))) {
    score -= 10;
  }

  // official signal (0-20)
  if (input.kind === "GITHUB" || input.kind === "GITEE") {
    score += 20;
  } else if (input.kind === "WEBSITE" && input.projectWebsiteHost && host === input.projectWebsiteHost) {
    score += 18;
  } else if (url.includes("/app/") || url.includes("/detail/") || url.includes("/products/")) {
    score += 16;
  } else if (input.kind === "DOCS") {
    score += 12;
  } else {
    score += 4;
  }

  if (["twitter.com", "x.com", "linkedin.com", "youtube.com", "bilibili.com"].includes(host) && segments.length < 2) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

export function assessProjectSourceQuality(input: {
  url: string;
  kind: ProjectSourceKind;
  label?: string | null;
  isPrimary?: boolean;
  origin?: SourceQualityOrigin;
  projectWebsiteHost?: string | null;
  projectName?: string | null;
}): ProjectSourceQuality {
  const score = sourceCandidateScore({
    url: input.url,
    kind: input.kind,
    label: input.label,
    projectWebsiteHost: input.projectWebsiteHost,
    projectName: input.projectName,
  });
  const label = input.label?.trim() ?? "";
  const isEnriched = label.startsWith("enriched_");
  const isCurated = label.includes("curated_repository");
  const exact = isExactEntityPage(input.url, input.kind);
  const blacklisted = isBlacklistedPublicSourceUrl(input.url);

  const weakBase: ProjectSourceQuality = {
    trustLevel: "inferred",
    ownershipLevel: "third_party",
    entityAccuracy: "weak",
    visibility: "internal",
    verificationStatus: "failed",
    sourceCandidateScore: score,
  };

  if (blacklisted || !exact) {
    return weakBase;
  }

  if (input.origin === "manual") {
    return {
      trustLevel: input.isPrimary ? "official" : "verified",
      ownershipLevel: "official",
      entityAccuracy: "exact",
      visibility: "public",
      verificationStatus: "verified",
      sourceCandidateScore: score,
    };
  }

  if (score < MIN_PUBLIC_SOURCE_SCORE) {
    return weakBase;
  }

  if (
    input.isPrimary ||
    (!isEnriched && (input.kind === "GITHUB" || input.kind === "GITEE" || input.kind === "WEBSITE")) ||
    input.origin === "import"
  ) {
    return {
      trustLevel: "official",
      ownershipLevel: "official",
      entityAccuracy: "exact",
      visibility: "public",
      verificationStatus: "verified",
      sourceCandidateScore: score,
    };
  }

  if (isCurated) {
    return {
      trustLevel: "verified",
      ownershipLevel: "third_party",
      entityAccuracy: "exact",
      visibility: "public",
      verificationStatus: "verified",
      sourceCandidateScore: score,
    };
  }

  if (
    isEnriched &&
    score >= MIN_PUBLIC_SOURCE_SCORE &&
    (label === "enriched_github" ||
      label === "enriched_docs" ||
      label === "enriched_app_store" ||
      label === "enriched_chrome_store" ||
      label === "enriched_play_store" ||
      label === "enriched_producthunt")
  ) {
    return {
      trustLevel: "verified",
      ownershipLevel: "official",
      entityAccuracy: "exact",
      visibility: "public",
      verificationStatus: "verified",
      sourceCandidateScore: score,
    };
  }

  return weakBase;
}

export function isPublicDisplaySource(source: {
  visibility?: SourceVisibility | null;
  trustLevel?: SourceTrustLevel | null;
  entityAccuracy?: SourceEntityAccuracy | null;
}): boolean {
  if (source.visibility !== "public") {
    return false;
  }
  if (source.entityAccuracy !== "exact") {
    return false;
  }
  return source.trustLevel === "official" || source.trustLevel === "verified";
}

export function sourceQualityDefaultsForCreate(input: {
  url: string;
  kind: ProjectSourceKind;
  label?: string | null;
  isPrimary?: boolean;
  origin?: SourceQualityOrigin;
  projectWebsiteHost?: string | null;
  projectName?: string | null;
}): ProjectSourceQuality {
  return assessProjectSourceQuality(input);
}

/** Prisma ProjectSource 可持久化字段（不含运行时评分 sourceCandidateScore） */
export function pickProjectSourceQualityFields(
  quality: ProjectSourceQuality,
): Pick<
  ProjectSourceQuality,
  "trustLevel" | "ownershipLevel" | "entityAccuracy" | "visibility" | "verificationStatus"
> {
  return {
    trustLevel: quality.trustLevel,
    ownershipLevel: quality.ownershipLevel,
    entityAccuracy: quality.entityAccuracy,
    visibility: quality.visibility,
    verificationStatus: quality.verificationStatus,
  };
}

export async function countPublicProjectSources(projectId: string): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  return prisma.projectSource.count({
    where: {
      projectId,
      visibility: "public",
      entityAccuracy: "exact",
      trustLevel: { in: ["official", "verified"] },
    },
  });
}

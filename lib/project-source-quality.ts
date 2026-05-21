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
};

export type SourceQualityOrigin = "import" | "enrichment" | "manual" | "curated";

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

function isPlatformHomepage(url: string): boolean {
  const host = plainHost(url);
  const segments = pathSegments(url);
  if (!host) {
    return true;
  }
  if (host === "github.com" && segments.length < 2) {
    return true;
  }
  if ((host === "twitter.com" || host === "x.com") && (segments.length === 0 || segments[0] === "home")) {
    return true;
  }
  if (host === "bilibili.com" && !url.includes("/video/")) {
    return true;
  }
  if (host === "zhihu.com" && segments.length < 2) {
    return true;
  }
  if (host === "producthunt.com" && segments.length === 0) {
    return true;
  }
  if (host === "apps.apple.com" && !url.includes("/app/")) {
    return true;
  }
  if (host === "play.google.com" && !url.includes("/store/apps/details")) {
    return true;
  }
  if (
    (host === "chromewebstore.google.com" || url.includes("chrome.google.com/webstore")) &&
    !url.includes("/detail/")
  ) {
    return true;
  }
  if (url.includes("x.com/intent/") || url.includes("twitter.com/intent/")) {
    return true;
  }
  return false;
}

function isExactEntityPage(url: string, kind: ProjectSourceKind): boolean {
  if (isPlatformHomepage(url)) {
    return false;
  }
  if (kind === "GITHUB" || kind === "GITEE") {
    return Boolean(normalizeGithubRepoUrlOrNull(url));
  }
  if (kind === "WEBSITE" || kind === "DOCS" || kind === "BLOG") {
    const segments = pathSegments(url);
    return segments.length > 0 || Boolean(plainHost(url));
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
    const segments = pathSegments(url);
    return segments.length >= 1 && !isPlatformHomepage(url);
  }
  if (kind === "OTHER") {
    return !isPlatformHomepage(url) && pathSegments(url).length >= 1;
  }
  return !isPlatformHomepage(url);
}

export function assessProjectSourceQuality(input: {
  url: string;
  kind: ProjectSourceKind;
  label?: string | null;
  isPrimary?: boolean;
  origin?: SourceQualityOrigin;
  projectWebsiteHost?: string | null;
}): ProjectSourceQuality {
  const label = input.label?.trim() ?? "";
  const isEnriched = label.startsWith("enriched_");
  const isCurated = label.includes("curated_repository");
  const exact = isExactEntityPage(input.url, input.kind);
  const platformHome = isPlatformHomepage(input.url);

  if (platformHome || !exact) {
    return {
      trustLevel: "inferred",
      ownershipLevel: "third_party",
      entityAccuracy: "weak",
      visibility: "internal",
      verificationStatus: "failed",
    };
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
    };
  }

  if (isCurated) {
    return {
      trustLevel: "verified",
      ownershipLevel: "third_party",
      entityAccuracy: "exact",
      visibility: "public",
      verificationStatus: "verified",
    };
  }

  if (
    isEnriched &&
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
    };
  }

  if (isEnriched && label === "enriched_social") {
    return {
      trustLevel: "inferred",
      ownershipLevel: "third_party",
      entityAccuracy: "possible",
      visibility: "internal",
      verificationStatus: "pending",
    };
  }

  if (isEnriched) {
    return {
      trustLevel: "inferred",
      ownershipLevel: "third_party",
      entityAccuracy: "possible",
      visibility: "public",
      verificationStatus: "pending",
    };
  }

  return {
    trustLevel: "verified",
    ownershipLevel: "third_party",
    entityAccuracy: "exact",
    visibility: "public",
    verificationStatus: "verified",
  };
}

export function isPublicDisplaySource(source: {
  visibility?: SourceVisibility | null;
  trustLevel?: SourceTrustLevel | null;
  entityAccuracy?: SourceEntityAccuracy | null;
}): boolean {
  if (source.visibility === "internal") {
    return false;
  }
  if (source.entityAccuracy === "weak") {
    return false;
  }
  const trust = source.trustLevel ?? "inferred";
  if (trust !== "official" && trust !== "verified") {
    return false;
  }
  return source.entityAccuracy === "exact";
}

export function sourceQualityDefaultsForCreate(input: {
  url: string;
  kind: ProjectSourceKind;
  label?: string | null;
  isPrimary?: boolean;
  origin?: SourceQualityOrigin;
  projectWebsiteHost?: string | null;
}): ProjectSourceQuality {
  return assessProjectSourceQuality(input);
}

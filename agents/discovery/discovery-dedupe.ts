import type { DiscoveryItem } from "./discovery-types";
import { parseGitHubRepoRef } from "./github/github-utils";

export function normalizeUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) {
    return null;
  }
  try {
    const u = new URL(raw);
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    u.pathname = path || "/";
    return u.toString().replace(/\/$/, u.pathname === "/" ? "/" : "");
  } catch {
    return null;
  }
}

export function getGitHubRepoKey(url: string): string | null {
  const ref = parseGitHubRepoRef(url);
  if (!ref) {
    return null;
  }
  return `${ref.owner}/${ref.repo}`.toLowerCase();
}

export function getWebsiteHost(url: string): string | null {
  const raw = url.trim();
  if (!raw) {
    return null;
  }
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[~`!@#$%^&*()_+=[\]{}|\\:;"'<>,.?/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type DedupeSnapshot = {
  normalizedUrl: string | null;
  githubRepoKey: string | null;
  websiteHost: string | null;
  normalizedTitle: string;
};

function snapshotForItem(item: Pick<DiscoveryItem, "url" | "title" | "normalizedUrl" | "githubRepoKey" | "websiteHost">): DedupeSnapshot {
  return {
    normalizedUrl: item.normalizedUrl ?? normalizeUrl(item.url),
    githubRepoKey: item.githubRepoKey ?? getGitHubRepoKey(item.url),
    websiteHost: item.websiteHost ?? getWebsiteHost(item.url),
    normalizedTitle: normalizeTitle(item.title),
  };
}

export function buildDiscoveryDedupeFields(input: Pick<DiscoveryItem, "url" | "title">): {
  normalizedUrl?: string;
  githubRepoKey?: string;
  websiteHost?: string;
} {
  const nUrl = normalizeUrl(input.url);
  const gh = getGitHubRepoKey(input.url);
  const host = getWebsiteHost(input.url);
  return {
    normalizedUrl: nUrl ?? undefined,
    githubRepoKey: gh ?? undefined,
    websiteHost: host ?? undefined,
  };
}

export function findStrongDuplicateItem(
  list: DiscoveryItem[],
  candidate: Pick<DiscoveryItem, "url" | "title" | "normalizedUrl" | "githubRepoKey" | "websiteHost">,
): DiscoveryItem | null {
  const c = snapshotForItem(candidate);
  if (c.normalizedUrl) {
    const hit = list.find((x) => snapshotForItem(x).normalizedUrl === c.normalizedUrl);
    if (hit) {
      return hit;
    }
  }
  if (c.githubRepoKey) {
    const hit = list.find((x) => snapshotForItem(x).githubRepoKey === c.githubRepoKey);
    if (hit) {
      return hit;
    }
  }
  if (c.websiteHost && c.normalizedTitle) {
    const hit = list.find((x) => {
      const s = snapshotForItem(x);
      return s.websiteHost === c.websiteHost && s.normalizedTitle === c.normalizedTitle;
    });
    if (hit) {
      return hit;
    }
  }
  return null;
}

export function findPossibleDuplicateByTitle(
  list: DiscoveryItem[],
  candidate: Pick<DiscoveryItem, "title">,
): DiscoveryItem | null {
  const nt = normalizeTitle(candidate.title);
  if (!nt) {
    return null;
  }
  return list.find((x) => normalizeTitle(x.title) === nt) ?? null;
}

import type { GithubRepoSearchItem } from "../github-search";

export type GithubDiscoveryFilterReason = "low_stars" | "outdated" | "fork" | "no_description";

export type GithubDiscoveryFilterResult =
  | { accepted: true }
  | { accepted: false; reason: GithubDiscoveryFilterReason };

const MIN_STARS = 5;
const MAX_STALE_DAYS = 365;

function daysSince(isoTime: string): number {
  const ts = Date.parse(isoTime);
  if (!Number.isFinite(ts)) {
    return Number.POSITIVE_INFINITY;
  }
  return (Date.now() - ts) / (24 * 60 * 60 * 1000);
}

export function filterGithubRepository(repo: GithubRepoSearchItem): GithubDiscoveryFilterResult {
  if ((repo.stargazers_count ?? 0) < MIN_STARS) {
    return { accepted: false, reason: "low_stars" };
  }
  if (repo.fork === true) {
    return { accepted: false, reason: "fork" };
  }
  if (!repo.description || !repo.description.trim()) {
    return { accepted: false, reason: "no_description" };
  }
  if (!repo.pushed_at || daysSince(repo.pushed_at) > MAX_STALE_DAYS) {
    return { accepted: false, reason: "outdated" };
  }
  return { accepted: true };
}

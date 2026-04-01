import type { GithubRepoSearchItemV2 } from "@/lib/discovery/github/search-repos";
import { buildGithubNormalizedKey, normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { discoveryDedupeHashFromNormalizedKey } from "@/lib/discovery/dedupe-hash";
import { slugifyProjectName } from "@/lib/project-slug";
import type { GithubCandidatePayload } from "@/lib/discovery/map-github-repo";
import type { JsonValue } from "@/lib/discovery/types";

function parseGhDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 由 GitHub Search API 条目构造候选（Topic 抓取主路径，避免逐仓库 /repos） */
export function mapGithubSearchItemToCandidatePayload(
  item: GithubRepoSearchItemV2,
): GithubCandidatePayload | null {
  const full = item.full_name?.trim();
  if (!full || !item.html_url) {
    return null;
  }
  const [ownerPart, repoPart] = full.split("/");
  if (!ownerPart || !repoPart) {
    return null;
  }
  const normalizedKey = buildGithubNormalizedKey(ownerPart, repoPart);
  const repoUrl = normalizeGithubRepoUrl(item.html_url);
  const dedupeHash = discoveryDedupeHashFromNormalizedKey(normalizedKey);
  const name = item.name?.trim() || repoPart;
  const slugCandidateRaw = slugifyProjectName(name);
  const topics = Array.isArray(item.topics) ? item.topics : [];
  const description = item.description?.trim() ? item.description.trim() : null;
  const summary =
    description && description.length > 360 ? `${description.slice(0, 357)}…` : description;
  const homepage = item.homepage?.trim() ? item.homepage.trim() : null;

  const rawPayloadJson: JsonValue = {
    source: "github-search",
    id: item.id,
    full_name: full,
    html_url: repoUrl,
    topics,
    pushed_at: item.pushed_at,
  };

  return {
    externalType: "github",
    externalId: String(item.id),
    externalUrl: repoUrl,
    normalizedKey,
    dedupeHash,
    title: name,
    slugCandidate: slugCandidateRaw || null,
    summary,
    descriptionRaw: description,
    website: homepage,
    repoUrl,
    docsUrl: null,
    twitterUrl: null,
    language: item.language ?? null,
    openSourceLicense: null,
    stars: typeof item.stargazers_count === "number" ? item.stargazers_count : 0,
    forks: typeof item.forks_count === "number" ? item.forks_count : 0,
    watchers: typeof item.watchers_count === "number" ? item.watchers_count : 0,
    issues: typeof item.open_issues_count === "number" ? item.open_issues_count : 0,
    lastCommitAt: parseGhDate(item.pushed_at),
    repoCreatedAt: null,
    repoUpdatedAt: parseGhDate(item.pushed_at),
    ownerName: item.owner?.login?.trim() || ownerPart,
    ownerUrl: item.owner?.login
      ? `https://github.com/${encodeURIComponent(item.owner.login)}`
      : null,
    avatarUrl: null,
    tagsJson: topics,
    categoriesJson: topics.length ? { githubTopics: topics } : [],
    rawPayloadJson,
  };
}

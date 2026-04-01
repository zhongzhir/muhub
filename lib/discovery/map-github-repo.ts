import type { GithubRepoFull } from "@/lib/discovery/github/repo-api";
import { buildGithubNormalizedKey, normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { discoveryDedupeHashFromNormalizedKey } from "@/lib/discovery/dedupe-hash";
import { slugifyProjectName } from "@/lib/project-slug";
import type { JsonValue } from "@/lib/discovery/types";

export type GithubCandidatePayload = {
  externalType: "github";
  externalId: string;
  externalUrl: string;
  normalizedKey: string;
  dedupeHash: string;
  title: string;
  slugCandidate: string | null;
  summary: string | null;
  descriptionRaw: string | null;
  website: string | null;
  repoUrl: string;
  docsUrl: null;
  twitterUrl: null;
  language: string | null;
  openSourceLicense: string | null;
  stars: number;
  forks: number;
  watchers: number;
  issues: number;
  lastCommitAt: Date | null;
  repoCreatedAt: Date | null;
  repoUpdatedAt: Date | null;
  ownerName: string;
  ownerUrl: string | null;
  avatarUrl: string | null;
  tagsJson: JsonValue;
  categoriesJson: JsonValue;
  rawPayloadJson: JsonValue;
};

function parseGhDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapGithubRepoToCandidatePayload(repo: GithubRepoFull): GithubCandidatePayload | null {
  const full = repo.full_name?.trim();
  if (!full || !repo.html_url) {
    return null;
  }
  const [ownerPart, repoPart] = full.split("/");
  if (!ownerPart || !repoPart) {
    return null;
  }
  const normalizedKey = buildGithubNormalizedKey(ownerPart, repoPart);
  const repoUrl = normalizeGithubRepoUrl(repo.html_url);
  const dedupeHash = discoveryDedupeHashFromNormalizedKey(normalizedKey);
  const name = repo.name?.trim() || repoPart;
  const slugCandidateRaw = slugifyProjectName(name);
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  const lic =
    repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION"
      ? repo.license.spdx_id
      : repo.license?.name ?? null;

  const description = repo.description?.trim() ? repo.description.trim() : null;
  const summary =
    description && description.length > 360 ? `${description.slice(0, 357)}…` : description;

  const homepage = repo.homepage?.trim() ? repo.homepage.trim() : null;

  return {
    externalType: "github",
    externalId: String(repo.id),
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
    language: repo.language ?? null,
    openSourceLicense: lic,
    stars: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
    forks: typeof repo.forks_count === "number" ? repo.forks_count : 0,
    watchers: typeof repo.watchers_count === "number" ? repo.watchers_count : 0,
    issues: typeof repo.open_issues_count === "number" ? repo.open_issues_count : 0,
    lastCommitAt: parseGhDate(repo.pushed_at),
    repoCreatedAt: parseGhDate(repo.created_at),
    repoUpdatedAt: parseGhDate(repo.updated_at),
    ownerName: repo.owner?.login?.trim() || ownerPart,
    ownerUrl: repo.owner?.html_url?.trim() || null,
    avatarUrl: repo.owner?.avatar_url?.trim() || null,
    tagsJson: topics,
    categoriesJson: topics.length ? { githubTopics: topics } : [],
    rawPayloadJson: {
      full_name: full,
      html_url: repoUrl,
      topics,
      pushed_at: repo.pushed_at,
    },
  };
}

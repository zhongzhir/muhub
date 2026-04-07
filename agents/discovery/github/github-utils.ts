import type { GitHubRepoRef } from "./github-types";

const GITHUB_HOST = "github.com";

function trimSlashes(s: string): string {
  return s.replace(/^\/+|\/+$/g, "");
}

function repoSegmentsFromUrl(url: string): [string, string] | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.hostname.toLowerCase() !== GITHUB_HOST) {
    return null;
  }
  const parts = trimSlashes(u.pathname).split("/").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const owner = parts[0]?.trim();
  let repo = parts[1]?.trim();
  if (!owner || !repo) {
    return null;
  }
  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }
  if (!repo) {
    return null;
  }
  return [owner, repo];
}

export function isGitHubRepoUrl(url: string): boolean {
  return repoSegmentsFromUrl(url) !== null;
}

export function normalizeGitHubRepoUrl(url: string): string | null {
  const seg = repoSegmentsFromUrl(url);
  if (!seg) {
    return null;
  }
  const [owner, repo] = seg;
  return `https://github.com/${owner}/${repo}`;
}

export function parseGitHubRepoRef(url: string): GitHubRepoRef | null {
  const normalizedUrl = normalizeGitHubRepoUrl(url);
  if (!normalizedUrl) {
    return null;
  }
  const seg = repoSegmentsFromUrl(normalizedUrl);
  if (!seg) {
    return null;
  }
  const [owner, repo] = seg;
  return {
    owner,
    repo,
    url: normalizedUrl,
    normalizedUrl,
  };
}

export function buildGitHubDiscoveryTitle(ref: GitHubRepoRef): string {
  return `${ref.owner}/${ref.repo}`;
}

export function buildGitHubDiscoveryDescription(ref: GitHubRepoRef): string {
  return `GitHub repository: ${ref.owner}/${ref.repo}`;
}

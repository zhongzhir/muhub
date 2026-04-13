import { fetchGithubSearchRepositories, type GithubRepoSearchItem } from "../github-search";
import { normalizeGitHubRepoUrl } from "./github-utils";

export type GitHubRelatedSeed = {
  fullName: string;
  keyword?: string;
};

export type GitHubRelatedCandidate = {
  seedRepo: string;
  query: string;
  url: string;
  repo: GithubRepoSearchItem;
};

function buildRelatedQueries(seed: GitHubRelatedSeed): string[] {
  const [owner = "", repo = ""] = seed.fullName.split("/");
  const token = repo.toLowerCase().replace(/[^a-z0-9-]/g, " ").trim();
  const firstKeyword = seed.keyword?.trim();
  const queries: string[] = [];
  if (token) {
    queries.push(`${token} stars:>10 pushed:>${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}`);
  }
  if (firstKeyword) {
    queries.push(`${firstKeyword} ${owner}`.trim());
  }
  return queries.slice(0, 2);
}

export async function searchGitHubRelatedRepos(
  seeds: GitHubRelatedSeed[],
  maxRelatedSeeds: number,
  searchDelayMs = 1500,
): Promise<GitHubRelatedCandidate[]> {
  const selectedSeeds = seeds.slice(0, Math.max(0, maxRelatedSeeds));
  const candidates = new Map<string, GitHubRelatedCandidate>();

  for (const seed of selectedSeeds) {
    const queries = buildRelatedQueries(seed);
    for (const query of queries) {
      const result = await fetchGithubSearchRepositories(query, {
        sort: "updated",
        perPage: 15,
        delayMs: searchDelayMs,
      });
      if (!result.ok) {
        console.warn(`[GitHub Discovery V3] related seed="${seed.fullName}" failed: ${result.error}`);
        continue;
      }
      for (const repo of result.items) {
        const url = normalizeGitHubRepoUrl(repo.html_url ?? "");
        if (!url || candidates.has(url)) {
          continue;
        }
        candidates.set(url, {
          seedRepo: seed.fullName,
          query,
          url,
          repo,
        });
      }
    }
  }

  return [...candidates.values()];
}

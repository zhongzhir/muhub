import { fetchGithubSearchRepositories, type GithubRepoSearchItem } from "../github-search";
import { normalizeGitHubRepoUrl } from "./github-utils";

export const GITHUB_DISCOVERY_TOPICS = [
  "ai-agent",
  "ai-agents",
  "llm",
  "rag",
  "vector-database",
  "ai-tools",
  "open-source-ai",
  "prompt-engineering",
  "mcp",
  "workflow-automation",
] as const;

export type GitHubDiscoveryTopic = (typeof GITHUB_DISCOVERY_TOPICS)[number];

export type GitHubTopicCandidate = {
  topic: string;
  url: string;
  repo: GithubRepoSearchItem;
};

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export async function searchGitHubReposByTopic(
  topic: string,
  searchDelayMs = 1500,
): Promise<GitHubTopicCandidate[]> {
  const pushedAfter = isoDaysAgo(180);
  const query = `topic:${topic} stars:>10 pushed:>${pushedAfter}`;
  const result = await fetchGithubSearchRepositories(query, {
    sort: "stars",
    perPage: 20,
    delayMs: searchDelayMs,
  });
  if (!result.ok) {
    console.warn(`[GitHub Discovery V3] topic="${topic}" search failed: ${result.error}`);
    return [];
  }
  const out: GitHubTopicCandidate[] = [];
  for (const repo of result.items) {
    const url = normalizeGitHubRepoUrl(repo.html_url ?? "");
    if (!url) {
      continue;
    }
    out.push({ topic, url, repo });
  }
  return out;
}

export async function runGitHubTopicDiscovery(
  topics: readonly string[],
  searchDelayMs = 1500,
): Promise<GitHubTopicCandidate[]> {
  const merged = new Map<string, GitHubTopicCandidate>();
  for (const topic of topics) {
    const rows = await searchGitHubReposByTopic(topic, searchDelayMs);
    for (const row of rows) {
      if (!merged.has(row.url)) {
        merged.set(row.url, row);
      }
    }
  }
  return [...merged.values()];
}

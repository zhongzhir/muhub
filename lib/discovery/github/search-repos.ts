import { githubDiscoveryHeaders } from "@/lib/discovery/github/http";

export type GithubRepoSearchItemV2 = {
  id: number;
  name?: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count?: number;
  watchers_count?: number;
  open_issues_count?: number;
  language: string | null;
  pushed_at: string | null;
  homepage: string | null;
  owner?: { login?: string };
  topics?: string[];
};

type SearchResponse = {
  items?: GithubRepoSearchItemV2[];
};

export type FetchGithubTopicSearchResult =
  | { ok: true; items: GithubRepoSearchItemV2[] }
  | { ok: false; error: string; status?: number };

export async function fetchGithubRepositoriesByTopic(
  topic: string,
  options: { sort: "stars" | "updated"; perPage: number },
): Promise<FetchGithubTopicSearchResult> {
  const perPage = Math.min(100, Math.max(1, options.perPage));
  const q = `topic:${topic}`;
  const params = new URLSearchParams({
    q,
    sort: options.sort,
    order: "desc",
    per_page: String(perPage),
  });
  const url = `https://api.github.com/search/repositories?${params.toString()}`;

  if (!process.env.GITHUB_TOKEN?.trim() && !process.env.GITHUB_ACCESS_TOKEN?.trim()) {
    console.warn(
      "[discovery-v2] 未配置 GITHUB_TOKEN，GitHub 搜索速率受限（约 10 次/分钟）。",
    );
  }

  try {
    const res = await fetch(url, { headers: githubDiscoveryHeaders(), cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: text ? `HTTP ${res.status}: ${text.slice(0, 400)}` : `HTTP ${res.status}`,
        status: res.status,
      };
    }
    const json = (await res.json()) as SearchResponse;
    const items = Array.isArray(json.items) ? json.items : [];
    return { ok: true, items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * GitHub REST：仓库搜索。优先使用 GITHUB_TOKEN；无 token 时仍可调用（额度更低的未认证限额）。
 */

export type GithubRepoSearchItem = {
  id: number;
  name?: string;
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  pushed_at: string | null;
  homepage: string | null;
  owner?: { login?: string };
  topics?: string[];
};

type SearchResponse = {
  items?: GithubRepoSearchItem[];
  total_count?: number;
};

function githubHeaders(): Record<string, string> {
  const token =
    process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_ACCESS_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MUHUB-Discovery",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export type FetchGithubSearchResult =
  | { ok: true; items: GithubRepoSearchItem[] }
  | { ok: false; error: string; status?: number };

export async function fetchGithubSearchRepositories(
  q: string,
  options: { sort: "updated" | "stars"; perPage: number },
): Promise<FetchGithubSearchResult> {
  const params = new URLSearchParams({
    q,
    sort: options.sort,
    order: options.sort === "stars" ? "desc" : "desc",
    per_page: String(Math.min(100, Math.max(1, options.perPage))),
  });

  const url = `https://api.github.com/search/repositories?${params.toString()}`;

  if (!process.env.GITHUB_TOKEN?.trim() && !process.env.GITHUB_ACCESS_TOKEN?.trim()) {
    console.warn(
      "[discovery] 未配置 GITHUB_TOKEN / GITHUB_ACCESS_TOKEN，将使用未认证速率限制（约 10 次/分钟搜索）。",
    );
  }

  try {
    const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" });
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining != null) {
      console.info(`[discovery] GitHub rate limit remaining=${remaining} reset=${reset ?? "?"}`);
    }

    if (res.status === 403) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `GitHub API 403（可能触发速率限制）${text ? `: ${text.slice(0, 200)}` : ""}`,
        status: 403,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `GitHub search failed: HTTP ${res.status}`,
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

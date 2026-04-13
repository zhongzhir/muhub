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
  fork?: boolean;
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

function resolveGithubToken(): string {
  return process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_ACCESS_TOKEN?.trim() || "";
}

function githubHeaders(): Record<string, string> {
  const token = resolveGithubToken();
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

function formatGithubSearchErrorBody(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return "(empty)";
  }
  try {
    const j = JSON.parse(t) as {
      message?: string;
      errors?: unknown;
      documentation_url?: string;
    };
    const chunks: string[] = [];
    if (typeof j.message === "string" && j.message) {
      chunks.push(j.message);
    }
    if (j.errors !== undefined) {
      chunks.push(
        typeof j.errors === "string"
          ? j.errors
          : JSON.stringify(j.errors),
      );
    }
    if (chunks.length > 0) {
      return chunks.join(" | ");
    }
  } catch {
    /* 非 JSON，回退原文 */
  }
  return t.length > 4000 ? `${t.slice(0, 4000)}…` : t;
}

export async function fetchGithubSearchRepositories(
  q: string,
  options: { sort: "updated" | "stars"; perPage: number },
): Promise<FetchGithubSearchResult> {
  const perPage = Math.min(100, Math.max(1, options.perPage));
  const order = "desc";
  const params = new URLSearchParams({
    q,
    sort: options.sort,
    order,
    per_page: String(perPage),
  });

  const url = `https://api.github.com/search/repositories?${params.toString()}`;

  const token = resolveGithubToken();
  console.info(`[discovery] using github token: ${token ? "yes" : "no"}`);
  if (!token) {
    console.warn(
      "[discovery] 未配置 GITHUB_TOKEN / GITHUB_ACCESS_TOKEN，将使用未认证速率限制（约 10 次/分钟搜索）。",
    );
  }

  console.info(`[discovery] github search q=${q}`);
  console.info(`[discovery] github search url=${url}`);
  console.info(
    `[discovery] github search sort=${options.sort} order=${order} per_page=${perPage}`,
  );

  try {
    const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" });
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = res.headers.get("x-ratelimit-reset");
    if (remaining != null) {
      console.info(
        `[discovery] GitHub rate limit remaining=${remaining} reset=${reset ?? "?"}`,
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");

      if (res.status === 422) {
        console.error(
          `[discovery] github search 422 body=${formatGithubSearchErrorBody(text)}`,
        );
      }

      if (res.status === 403) {
        return {
          ok: false,
          error: `GitHub API 403（可能触发速率限制）${text ? `: ${text.slice(0, 200)}` : ""}`,
          status: 403,
        };
      }

      const detail = formatGithubSearchErrorBody(text);
      return {
        ok: false,
        error:
          detail && detail !== "(empty)"
            ? `GitHub search failed: HTTP ${res.status} — ${detail.slice(0, 500)}`
            : `GitHub search failed: HTTP ${res.status}`,
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

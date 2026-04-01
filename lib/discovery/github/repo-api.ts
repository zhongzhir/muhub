import { githubDiscoveryHeaders } from "@/lib/discovery/github/http";

/** GitHub REST GET /repos/{owner}/{repo} 精简类型 */
export type GithubRepoFull = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  language: string | null;
  topics?: string[];
  pushed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  owner: {
    login: string;
    html_url?: string;
    avatar_url?: string;
  };
  license?: { spdx_id?: string | null; name?: string | null } | null;
};

export type FetchGithubRepoResult =
  | { ok: true; repo: GithubRepoFull }
  | { ok: false; error: string; status?: number };

export async function fetchGithubRepoFull(
  owner: string,
  repo: string,
): Promise<FetchGithubRepoResult> {
  const o = encodeURIComponent(owner);
  const r = encodeURIComponent(repo);
  const url = `https://api.github.com/repos/${o}/${r}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: githubDiscoveryHeaders(), cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: text ? `HTTP ${res.status}: ${text.slice(0, 400)}` : `HTTP ${res.status}`,
      status: res.status,
    };
  }

  const json = (await res.json()) as GithubRepoFull;
  if (!json?.full_name || !json.html_url) {
    return { ok: false, error: "Invalid repo payload" };
  }
  return { ok: true, repo: json };
}

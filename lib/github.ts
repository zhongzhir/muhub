/**
 * GitHub REST API 解析与拉取（导入项目用）。
 * @see https://docs.github.com/en/rest/repos/repos#get-a-repository
 */

export type GitHubRepoImportPayload = {
  name: string;
  tagline: string;
  githubUrl: string;
  websiteUrl: string;
  ownerLogin: string;
  stars: number;
  forks: number;
};

type GitHubApiRepo = {
  name?: string;
  description?: string | null;
  html_url?: string;
  homepage?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  owner?: { login?: string };
};

export function parseGitHubRepoUrl(raw: string): { owner: string; repo: string } | null {
  const s = raw.trim();
  if (!s) {
    return null;
  }

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
      return null;
    }
    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const owner = segments[0]!;
    let repo = segments[1]!;
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

export type FetchGitHubRepoResult =
  | { ok: true; data: GitHubRepoImportPayload }
  | { ok: false; reason: "not_found" | "api_error" };

/**
 * CI / 本地 E2E：设置 GITHUB_IMPORT_E2E_FIXTURE=1 且请求
 * `https://github.com/muhub/e2e-fixture` 时返回固定数据，无需访问外网。
 */
const E2E_FIXTURE_OWNER = "muhub";
const E2E_FIXTURE_REPO = "e2e-fixture";

export async function fetchGitHubRepoForImport(
  owner: string,
  repo: string,
): Promise<FetchGitHubRepoResult> {
  if (
    process.env.GITHUB_IMPORT_E2E_FIXTURE === "1" &&
    owner === E2E_FIXTURE_OWNER &&
    repo === E2E_FIXTURE_REPO
  ) {
    return {
      ok: true,
      data: {
        name: "E2E Fixture Repo",
        tagline: "Fixture description for Playwright",
        githubUrl: `https://github.com/${E2E_FIXTURE_OWNER}/${E2E_FIXTURE_REPO}`,
        websiteUrl: "https://example.com",
        ownerLogin: E2E_FIXTURE_OWNER,
        stars: 42,
        forks: 7,
      },
    };
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MUHUB-Import",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });

    if (res.status === 404) {
      return { ok: false, reason: "not_found" };
    }

    if (!res.ok) {
      return { ok: false, reason: "api_error" };
    }

    const json = (await res.json()) as GitHubApiRepo;
    const name = typeof json.name === "string" ? json.name : repo;
    const desc = json.description;
    const tagline = typeof desc === "string" && desc.trim() ? desc.trim() : "";
    const htmlUrl =
      typeof json.html_url === "string" ? json.html_url : `https://github.com/${owner}/${repo}`;
    const home = json.homepage;
    const websiteUrl = typeof home === "string" && home.trim() ? home.trim() : "";
    const ownerLogin =
      typeof json.owner?.login === "string" && json.owner.login ? json.owner.login : owner;

    return {
      ok: true,
      data: {
        name,
        tagline,
        githubUrl: htmlUrl,
        websiteUrl,
        ownerLogin,
        stars: typeof json.stargazers_count === "number" ? json.stargazers_count : 0,
        forks: typeof json.forks_count === "number" ? json.forks_count : 0,
      },
    };
  } catch {
    return { ok: false, reason: "api_error" };
  }
}

function parseGithubIsoDate(s: string | null | undefined): Date | null {
  if (!s) {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /repos/{owner}/{repo}/releases/latest
 * 无 Release、404 或错误时返回 null（调用方可忽略）。
 */
export async function fetchGitHubLatestRelease(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<{ tag: string; publishedAt: Date | null } | null> {
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      tag_name?: string;
      published_at?: string | null;
    };
    const tag =
      typeof json.tag_name === "string" && json.tag_name.trim() ? json.tag_name.trim() : null;
    if (!tag) {
      return null;
    }
    return { tag, publishedAt: parseGithubIsoDate(json.published_at ?? undefined) };
  } catch {
    return null;
  }
}

/** 将导入结果编码为 /dashboard/projects/new 的 query（不含 slug / description） */
export function buildNewProjectSearchParams(data: GitHubRepoImportPayload): URLSearchParams {
  const p = new URLSearchParams();
  p.set("name", data.name);
  if (data.tagline) {
    p.set("tagline", data.tagline);
  }
  p.set("githubUrl", data.githubUrl);
  if (data.websiteUrl) {
    p.set("websiteUrl", data.websiteUrl);
  }
  return p;
}

/** 规范化为可比较的 GitHub 仓库 web 地址（小写 owner/repo，无末尾 / 与 .git） */
export function normalizeGithubRepoWebUrl(raw: string): string | null {
  const parsed = parseGitHubRepoUrl(raw.trim());
  if (!parsed) {
    return null;
  }
  return `https://github.com/${parsed.owner.toLowerCase()}/${parsed.repo.toLowerCase()}`;
}

/** 判断用户输入的仓库 URL 与项目存储的 githubUrl 是否指向同一仓库 */
export function githubRepoUrlsMatch(stored: string | null | undefined, input: string): boolean {
  if (!stored?.trim()) {
    return false;
  }
  const a = normalizeGithubRepoWebUrl(stored);
  const b = normalizeGithubRepoWebUrl(input);
  return Boolean(a && b && a === b);
}

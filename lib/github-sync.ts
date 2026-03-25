/**
 * GitHub 仓库快照拉取（手动刷新详情页指标）。
 * 仅 REST GET，无定时任务 / Webhook / OAuth。
 */

import { fetchGitHubLatestRelease, fetchGiteeRepoApi } from "@/lib/github";
import { parseRepoUrl } from "@/lib/repo-platform";
import { prisma } from "@/lib/prisma";

const E2E_FIXTURE_OWNER = "muhub";
const E2E_FIXTURE_REPO = "e2e-fixture";

function githubFixtureEnabled(): boolean {
  return (
    process.env.GITHUB_REFRESH_E2E_FIXTURE === "1" || process.env.GITHUB_IMPORT_E2E_FIXTURE === "1"
  );
}

function buildGithubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MUHUB-Sync",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

type GitHubRepoApi = {
  full_name?: string;
  default_branch?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  subscribers_count?: number;
  watchers?: number;
  watchers_count?: number;
  pushed_at?: string | null;
};

type GitHubCommitApi = {
  commit?: { committer?: { date?: string | null } };
};

export type GithubSnapshotPayload = {
  repoPlatform: "github" | "gitee";
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  defaultBranch: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  contributorsCount: number;
  lastCommitAt: Date | null;
  latestReleaseTag: string | null;
  latestReleaseAt: Date | null;
};

type FetchSnapshotResult =
  | { ok: true; data: GithubSnapshotPayload }
  | { ok: false; reason: "not_found" | "api_error" };

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s) {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function watchersFromRepoJson(json: GitHubRepoApi): number {
  if (typeof json.subscribers_count === "number") {
    return json.subscribers_count;
  }
  if (typeof json.watchers_count === "number") {
    return json.watchers_count;
  }
  if (typeof json.watchers === "number") {
    return json.watchers;
  }
  return 0;
}

async function fetchContributorsCount(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<number | null> {
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=100&anon=1`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    const arr = (await res.json()) as unknown;
    if (!Array.isArray(arr)) {
      return null;
    }
    return arr.length;
  } catch {
    return null;
  }
}

async function fetchLatestCommitDate(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<Date | null> {
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=1`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as unknown;
    const first = Array.isArray(json) ? (json[0] as GitHubCommitApi) : null;
    const iso = first?.commit?.committer?.date;
    return parseIsoDate(iso ?? undefined);
  } catch {
    return null;
  }
}

/**
 * 从 GitHub API 组装快照字段（不含 projectId / fetchedAt）。
 * fixture：与导入用例相同仓库时在 CI 下不走外网。
 */
export async function fetchGithubSnapshotPayload(
  owner: string,
  repo: string,
): Promise<FetchSnapshotResult> {
  if (githubFixtureEnabled() && owner === E2E_FIXTURE_OWNER && repo === E2E_FIXTURE_REPO) {
    const recent = new Date();
    recent.setUTCDate(recent.getUTCDate() - 2);
    const releaseAt = new Date();
    releaseAt.setUTCDate(releaseAt.getUTCDate() - 1);
    return {
      ok: true,
      data: {
        repoPlatform: "github",
        repoOwner: E2E_FIXTURE_OWNER,
        repoName: E2E_FIXTURE_REPO,
        repoFullName: `${E2E_FIXTURE_OWNER}/${E2E_FIXTURE_REPO}`,
        defaultBranch: "main",
        stars: 42,
        forks: 7,
        openIssues: 3,
        watchers: 5,
        contributorsCount: 3,
        lastCommitAt: recent,
        latestReleaseTag: "v0.9.9-fixture",
        latestReleaseAt: releaseAt,
      },
    };
  }

  const headers = buildGithubHeaders();
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

    const json = (await res.json()) as GitHubRepoApi;
    const fullName =
      typeof json.full_name === "string" && json.full_name.trim()
        ? json.full_name.trim()
        : `${owner}/${repo}`;

    let lastCommitAt = parseIsoDate(json.pushed_at ?? undefined);
    if (!lastCommitAt) {
      lastCommitAt = await fetchLatestCommitDate(owner, repo, headers);
    }

    const contributorsCount =
      (await fetchContributorsCount(owner, repo, headers)) ?? 0;

    const releaseInfo = await fetchGitHubLatestRelease(owner, repo, headers);
    const latestReleaseTag = releaseInfo?.tag ?? null;
    const latestReleaseAt = releaseInfo?.publishedAt ?? null;

    return {
      ok: true,
      data: {
        repoPlatform: "github",
        repoOwner: owner,
        repoName: repo,
        repoFullName: fullName,
        defaultBranch:
          typeof json.default_branch === "string" && json.default_branch
            ? json.default_branch
            : null,
        stars: typeof json.stargazers_count === "number" ? json.stargazers_count : 0,
        forks: typeof json.forks_count === "number" ? json.forks_count : 0,
        openIssues:
          typeof json.open_issues_count === "number" ? json.open_issues_count : 0,
        watchers: watchersFromRepoJson(json),
        contributorsCount,
        lastCommitAt,
        latestReleaseTag,
        latestReleaseAt,
      },
    };
  } catch {
    return { ok: false, reason: "api_error" };
  }
}

async function fetchGiteeSnapshotPayload(
  owner: string,
  repo: string,
): Promise<FetchSnapshotResult> {
  const r = await fetchGiteeRepoApi(owner, repo);
  if (r.kind === "not_found") {
    return { ok: false, reason: "not_found" };
  }
  const json = r.kind === "ok" ? r.json : null;
  const stars =
    json && typeof json.stargazers_count === "number" ? json.stargazers_count : 0;
  const forks = json && typeof json.forks_count === "number" ? json.forks_count : 0;
  const fullName =
    json && typeof json.full_name === "string" && json.full_name.trim()
      ? json.full_name.trim()
      : `${owner}/${repo}`;
  const defaultBranch =
    json && typeof json.default_branch === "string" && json.default_branch
      ? json.default_branch
      : null;
  const lastCommitAt = json ? parseIsoDate(json.pushed_at ?? undefined) : null;

  return {
    ok: true,
    data: {
      repoPlatform: "gitee",
      repoOwner: owner,
      repoName: repo,
      repoFullName: fullName,
      defaultBranch,
      stars,
      forks,
      openIssues: 0,
      watchers: 0,
      contributorsCount: 0,
      lastCommitAt,
      latestReleaseTag: null,
      latestReleaseAt: null,
    },
  };
}

export type SyncGithubSnapshotResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 校验 URL、请求 GitHub、插入一条 GithubRepoSnapshot（保留历史）。
 */
export async function syncGithubSnapshotForProjectSlug(
  slug: string,
): Promise<SyncGithubSnapshotResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, message: "未配置数据库，无法刷新。" };
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, githubUrl: true },
  });

  if (!project) {
    return { ok: false, message: "项目不存在或已被删除。" };
  }

  const rawUrl = project.githubUrl?.trim();
  if (!rawUrl) {
    return { ok: false, message: "未配置代码仓库地址" };
  }

  const parsed = parseRepoUrl(rawUrl);
  if (!parsed) {
    return { ok: false, message: "仓库地址格式错误（当前支持 GitHub、Gitee）" };
  }

  const fetched =
    parsed.platform === "github"
      ? await fetchGithubSnapshotPayload(parsed.owner, parsed.repo)
      : await fetchGiteeSnapshotPayload(parsed.owner, parsed.repo);
  if (!fetched.ok) {
    return {
      ok: false,
      message:
        fetched.reason === "not_found"
          ? "未找到该仓库"
          : "仓库数据请求失败，请稍后再试",
    };
  }

  try {
    await prisma.githubRepoSnapshot.create({
      data: {
        projectId: project.id,
        repoPlatform: fetched.data.repoPlatform,
        repoOwner: fetched.data.repoOwner,
        repoName: fetched.data.repoName,
        repoFullName: fetched.data.repoFullName,
        defaultBranch: fetched.data.defaultBranch,
        stars: fetched.data.stars,
        forks: fetched.data.forks,
        openIssues: fetched.data.openIssues,
        watchers: fetched.data.watchers,
        commitCount7d: 0,
        commitCount30d: 0,
        contributorsCount: fetched.data.contributorsCount,
        lastCommitAt: fetched.data.lastCommitAt,
        latestReleaseTag: fetched.data.latestReleaseTag,
        latestReleaseAt: fetched.data.latestReleaseAt,
      },
    });
  } catch (e) {
    console.error("[syncGithubSnapshotForProjectSlug]", e);
    return { ok: false, message: "仓库数据请求失败，请稍后再试" };
  }

  return { ok: true };
}

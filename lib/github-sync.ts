/**
 * GitHub 仓库快照拉取（手动刷新详情页指标）。
 * 仅 REST GET，无定时任务 / Webhook / OAuth。
 */

import type { Prisma } from "@prisma/client";
import { fetchGitHubLatestRelease, fetchGiteeRepoApi } from "@/lib/github";
import { createReleaseProjectUpdate } from "@/lib/github-release-update";
import { resolveProjectGithubUrl } from "@/lib/project-evidence-context";
import { parseRepoUrl } from "@/lib/repo-platform";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
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
  description?: string | null;
  language?: string | null;
  default_branch?: string | null;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  subscribers_count?: number;
  watchers?: number;
  watchers_count?: number;
  pushed_at?: string | null;
  license?: { spdx_id?: string | null; name?: string | null } | null;
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
  contributorsCount: number | null;
  lastCommitAt: Date | null;
  latestReleaseTag: string | null;
  latestReleaseAt: Date | null;
  description?: string | null;
  language?: string | null;
  topics?: string[];
  license?: string | null;
  openPullRequests?: number | null;
};

export type FetchSnapshotResult =
  | { ok: true; data: GithubSnapshotPayload }
  | { ok: false; reason: "not_found" | "api_error"; message?: string };

export type RefreshProjectGithubFactsResult =
  | { ok: true; refreshed: true }
  | { ok: true; refreshed: false; reason: "no_repo_url" | "skipped" }
  | { ok: false; lastFetchError: string; refreshed: false };

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

async function fetchRepoTopics(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<string[] | null> {
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/topics`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as { names?: unknown };
    if (!Array.isArray(json.names)) {
      return null;
    }
    return json.names.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return null;
  }
}

async function fetchOpenPullRequestsCount(
  owner: string,
  repo: string,
  headers: Record<string, string>,
): Promise<number | null> {
  try {
    const q = encodeURIComponent(`repo:${owner}/${repo} is:pr is:open`);
    const url = `https://api.github.com/search/issues?q=${q}&per_page=1`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as { total_count?: unknown };
    return typeof json.total_count === "number" ? json.total_count : null;
  } catch {
    return null;
  }
}

function licenseFromRepoJson(json: GitHubRepoApi): string | null {
  const license = json.license;
  if (!license) {
    return null;
  }
  if (typeof license.spdx_id === "string" && license.spdx_id.trim() && license.spdx_id !== "NOASSERTION") {
    return license.spdx_id.trim();
  }
  if (typeof license.name === "string" && license.name.trim()) {
    return license.name.trim();
  }
  return null;
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
      return {
        ok: false,
        reason: "api_error",
        message: `GitHub API ${res.status}`,
      };
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

    const [contributorsCount, topics, openPullRequests, releaseInfo] = await Promise.all([
      fetchContributorsCount(owner, repo, headers),
      fetchRepoTopics(owner, repo, headers),
      fetchOpenPullRequestsCount(owner, repo, headers),
      fetchGitHubLatestRelease(owner, repo, headers),
    ]);
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
        description:
          typeof json.description === "string" && json.description.trim()
            ? json.description.trim()
            : null,
        language:
          typeof json.language === "string" && json.language.trim() ? json.language.trim() : null,
        topics: topics ?? undefined,
        license: licenseFromRepoJson(json),
        openPullRequests,
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: "api_error",
      message: error instanceof Error ? error.message : "GitHub API request failed",
    };
  }
}

export async function fetchGiteeSnapshotPayload(
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
      contributorsCount: null,
      lastCommitAt,
      latestReleaseTag: null,
      latestReleaseAt: null,
    },
  };
}

function parseAiSignalsJson(raw: Prisma.JsonValue | null): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

function parseAiSignalsGithub(raw: Prisma.JsonValue | null): Record<string, unknown> {
  const root = parseAiSignalsJson(raw);
  const github = root.github;
  if (!github || typeof github !== "object" || Array.isArray(github)) {
    return {};
  }
  return github as Record<string, unknown>;
}

async function persistGithubFetchError(projectId: string, message: string): Promise<void> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { aiSignals: true },
  });
  if (!row) {
    return;
  }
  const prevGithub = parseAiSignalsGithub(row.aiSignals);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      aiSignals: {
        ...parseAiSignalsJson(row.aiSignals),
        github: {
          ...prevGithub,
          lastFetchError: message.slice(0, 500),
          lastFetchAt: new Date().toISOString(),
        },
      } as Prisma.InputJsonValue,
    },
  });
}

async function persistGithubFetchSuccess(
  projectId: string,
  payload: GithubSnapshotPayload,
): Promise<void> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { aiSignals: true },
  });
  if (!row) {
    return;
  }
  const prevGithub = parseAiSignalsGithub(row.aiSignals);
  const { lastFetchError, ...restGithub } = prevGithub;
  void lastFetchError;
  await prisma.project.update({
    where: { id: projectId },
    data: {
      aiSignals: {
        ...parseAiSignalsJson(row.aiSignals),
        github: {
          ...restGithub,
          description: payload.description ?? restGithub.description ?? null,
          language: payload.language ?? restGithub.language ?? null,
          topics: payload.topics ?? restGithub.topics ?? undefined,
          license: payload.license ?? restGithub.license ?? null,
          openPullRequests: payload.openPullRequests ?? restGithub.openPullRequests ?? null,
          lastFetchAt: new Date().toISOString(),
          lastFetchError: null,
        },
      } as Prisma.InputJsonValue,
    },
  });
}

type PreviousGithubSnapshot = {
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  contributorsCount: number;
  lastCommitAt: Date | null;
  defaultBranch: string | null;
  latestReleaseTag: string | null;
  latestReleaseAt: Date | null;
};

function mergeSnapshotWithPrevious(
  fetched: GithubSnapshotPayload,
  prev: PreviousGithubSnapshot | null,
): GithubSnapshotPayload {
  if (!prev) {
    return {
      ...fetched,
      contributorsCount: fetched.contributorsCount ?? 0,
    };
  }
  return {
    ...fetched,
    contributorsCount: fetched.contributorsCount ?? prev.contributorsCount,
  };
}

async function insertGithubRepoSnapshot(
  projectId: string,
  data: GithubSnapshotPayload,
  prevSnap: { latestReleaseTag: string | null } | null,
): Promise<void> {
  await prisma.githubRepoSnapshot.create({
    data: {
      projectId,
      repoPlatform: data.repoPlatform,
      repoOwner: data.repoOwner,
      repoName: data.repoName,
      repoFullName: data.repoFullName,
      defaultBranch: data.defaultBranch,
      stars: data.stars,
      forks: data.forks,
      openIssues: data.openIssues,
      watchers: data.watchers,
      commitCount7d: 0,
      commitCount30d: 0,
      contributorsCount: data.contributorsCount ?? 0,
      lastCommitAt: data.lastCommitAt,
      latestReleaseTag: data.latestReleaseTag,
      latestReleaseAt: data.latestReleaseAt,
    },
  });

  const tag = data.latestReleaseTag?.trim();
  const releaseAt = data.latestReleaseAt;
  if (tag && releaseAt && (!prevSnap?.latestReleaseTag || prevSnap.latestReleaseTag !== tag)) {
    try {
      await createReleaseProjectUpdate({
        projectId,
        platform: data.repoPlatform,
        owner: data.repoOwner,
        repo: data.repoName,
        tag,
        releaseAt,
      });
    } catch (e) {
      console.error("[insertGithubRepoSnapshot] release update", e);
    }
  }
}

/**
 * 为项目拉取最新 GitHub/Gitee 仓库指标并写入 GithubRepoSnapshot。
 * API 失败时不写入快照、不用 0 覆盖已有值，并在 aiSignals.github.lastFetchError 记录错误。
 */
export async function refreshProjectGithubFacts(
  projectId: string,
): Promise<RefreshProjectGithubFactsResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, refreshed: false, lastFetchError: "未配置数据库" };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      githubUrl: true,
      aiSignals: true,
      sources: {
        select: { kind: true, url: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!project) {
    return { ok: false, refreshed: false, lastFetchError: "项目不存在或已删除" };
  }

  const rawUrl = resolveProjectGithubUrl({
    githubUrl: project.githubUrl,
    sources: project.sources,
  });
  if (!rawUrl) {
    return { ok: true, refreshed: false, reason: "no_repo_url" };
  }

  const parsed = parseRepoUrl(rawUrl);
  if (!parsed) {
    const message = "仓库地址格式错误（当前支持 GitHub、Gitee）";
    await persistGithubFetchError(projectId, message);
    return { ok: false, refreshed: false, lastFetchError: message };
  }

  const fetched =
    parsed.platform === "github"
      ? await fetchGithubSnapshotPayload(parsed.owner, parsed.repo)
      : await fetchGiteeSnapshotPayload(parsed.owner, parsed.repo);

  if (!fetched.ok) {
    const message =
      fetched.reason === "not_found"
        ? "未找到该仓库"
        : fetched.message?.trim() || "仓库数据请求失败，请稍后再试";
    await persistGithubFetchError(projectId, message);
    console.warn("[refreshProjectGithubFacts] fetch failed", {
      projectId,
      rawUrl,
      reason: fetched.reason,
      message,
    });
    return { ok: false, refreshed: false, lastFetchError: message };
  }

  const prevSnap = await prisma.githubRepoSnapshot.findFirst({
    where: { projectId },
    orderBy: { fetchedAt: "desc" },
    select: {
      stars: true,
      forks: true,
      openIssues: true,
      watchers: true,
      contributorsCount: true,
      lastCommitAt: true,
      defaultBranch: true,
      latestReleaseTag: true,
      latestReleaseAt: true,
    },
  });

  const merged = mergeSnapshotWithPrevious(fetched.data, prevSnap);

  try {
    await insertGithubRepoSnapshot(projectId, merged, prevSnap);
    await persistGithubFetchSuccess(projectId, merged);
  } catch (error) {
    const message = error instanceof Error ? error.message : "写入仓库快照失败";
    console.error("[refreshProjectGithubFacts]", error);
    await persistGithubFetchError(projectId, message);
    return { ok: false, refreshed: false, lastFetchError: message };
  }

  return { ok: true, refreshed: true };
}

export type SyncGithubSnapshotResult =
  | { ok: true }
  | { ok: false; message: string };

/** 拉取远端仓库指标（不写库），供运营脚本对比快照 */
export async function fetchLiveRepoSnapshotForUrl(rawUrl: string): Promise<FetchSnapshotResult> {
  const parsed = parseRepoUrl(rawUrl.trim());
  if (!parsed) {
    return { ok: false, reason: "api_error" };
  }
  if (parsed.platform === "github") {
    return fetchGithubSnapshotPayload(parsed.owner, parsed.repo);
  }
  return fetchGiteeSnapshotPayload(parsed.owner, parsed.repo);
}

/**
 * 校验 URL、请求 GitHub、插入一条 GithubRepoSnapshot（保留历史）。
 */
export async function syncGithubSnapshotForProjectSlug(
  slug: string,
): Promise<SyncGithubSnapshotResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, message: "未配置数据库，无法刷新。" };
  }

  const project = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, githubUrl: true },
  });

  if (!project) {
    return { ok: false, message: "项目不存在或已被删除。" };
  }

  if (!project.githubUrl?.trim()) {
    return { ok: false, message: "未配置代码仓库地址" };
  }

  const result = await refreshProjectGithubFacts(project.id);
  if (result.ok && result.refreshed) {
    return { ok: true };
  }
  if (result.ok && !result.refreshed) {
    return { ok: false, message: "未配置代码仓库地址" };
  }
  return { ok: false, message: result.lastFetchError };
}

"use server";

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  appendDiscoveryItem,
  readDiscoveryItemById,
  readDiscoveryItems,
  updateDiscoveryItemDuplicateResult,
  updateDiscoveryItemImportResult,
  updateDiscoveryStatus,
} from "@/agents/discovery/discovery-store";
import type { DiscoveryItem } from "@/agents/discovery/discovery-types";
import { runGitHubDiscoveryV3 } from "@/agents/discovery/github/github-discovery-v3";
import { runRssDiscovery } from "@/agents/discovery/rss/rss-discovery";
import { runGitHubProjectActivity } from "@/agents/activity/github-activity";
import { importJsonDiscoveryItem } from "@/lib/discovery/import-json-queue-item";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { prisma } from "@/lib/prisma";
import { slugifyProjectName } from "@/lib/project-slug";
import { parseRepoUrl } from "@/lib/repo-platform";

const REVALIDATE = "/admin/discovery/items";
const execFileAsync = promisify(execFile);

export type ImportDiscoveryItemResult = {
  ok: boolean;
  message?: string;
  slug?: string;
};

export type RunGithubDiscoveryV3Result =
  | {
      ok: true;
      summary: Awaited<ReturnType<typeof runGitHubDiscoveryV3>>;
    }
  | { ok: false; error: string };

export type RunRssDiscoveryResult =
  | {
      ok: true;
      summary: { before: number; after: number; delta: number };
    }
  | { ok: false; error: string };

export type RunProjectActivityResult =
  | {
      ok: true;
      processed: number;
      created: number;
    }
  | { ok: false; error: string };

export type RunContentPipelineResult =
  | {
      ok: true;
      message: string;
      output: string;
    }
  | {
      ok: false;
      error: string;
    };

export type BulkDiscoveryStatusResult =
  | { ok: true; updated: number }
  | { ok: false; error: string };

export type BulkImportResult =
  | { ok: true; success: number; failed: number; skipped: number }
  | { ok: false; error: string };

type ExistingProjectHit = {
  id: string;
  slug: string;
  name: string;
  reason: "githubUrl" | "websiteUrl" | "slug" | "name";
};

export type ParseManualGithubProjectResult =
  | {
      ok: true;
      parsed: {
        githubUrl: string;
        owner: string;
        repo: string;
        title: string;
        summary: string | null;
        homepage: string | null;
        stargazersCount: number;
        language: string | null;
      };
      duplicate: ExistingProjectHit | null;
    }
  | { ok: false; error: string };

export type AddManualGithubToQueueResult =
  | { ok: true; duplicate: boolean; message: string }
  | { ok: false; error: string };

export type ImportManualGithubProjectResult =
  | { ok: true; slug: string; duplicated: boolean; message: string }
  | { ok: false; error: string };

type BulkExtractedGithubProject = {
  githubUrl: string;
  owner: string;
  repo: string;
  projectName: string;
  summary: string | null;
  stars: number;
  language: string | null;
  websiteUrl: string | null;
  status: "ready" | "duplicate" | "error";
  errorMessage?: string;
  duplicateProject?: { slug: string; name: string } | null;
};

export type ExtractGithubProjectsFromArticleResult =
  | {
      ok: true;
      items: BulkExtractedGithubProject[];
      totalUrls: number;
      uniqueRepoUrls: number;
    }
  | { ok: false; error: string };

export type BulkAddGithubProjectsToQueueResult =
  | {
      ok: true;
      success: number;
      duplicate: number;
      failed: number;
      message: string;
    }
  | { ok: false; error: string };

function normalizeGithubRepoUrlFromAny(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const owner = segments[0] || "";
    let repo = segments[1] || "";
    if (!owner || !repo) {
      return null;
    }
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }
    if (!owner || !repo) {
      return null;
    }
    return normalizeGithubRepoUrl(`https://github.com/${owner}/${repo}`);
  } catch {
    return null;
  }
}

function extractGithubRepoUrlsFromArticleText(articleBody: string): string[] {
  const text = articleBody.trim();
  if (!text) {
    return [];
  }
  const pattern =
    /((?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/[^\s)\]}>，。；;、]*)?)/gi;
  const matches = Array.from(text.matchAll(pattern), (match) => match[1] ?? "").filter(Boolean);
  const unique = new Set<string>();
  for (const m of matches) {
    const normalized = normalizeGithubRepoUrlFromAny(m);
    if (!normalized) {
      continue;
    }
    unique.add(normalized);
  }
  return Array.from(unique);
}

function createManualDiscoveryItem(input: {
  githubUrl: string;
  websiteUrl?: string | null;
  title: string;
  summary?: string | null;
  note?: string | null;
  language?: string | null;
  stars?: number;
  owner?: string;
  repo?: string;
}): DiscoveryItem {
  const now = new Date().toISOString();
  return {
    id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: "manual",
    title: input.title.trim(),
    url: input.githubUrl,
    description: input.summary?.trim() || undefined,
    status: "new",
    createdAt: now,
    meta: {
      source: "manual-github",
      sourceKey: "manual-github",
      githubUrl: input.githubUrl,
      websiteUrl: input.websiteUrl?.trim() || null,
      note: input.note?.trim() || null,
      language: input.language?.trim() || null,
      stars: input.stars ?? 0,
      owner: input.owner ?? null,
      repo: input.repo ?? null,
    },
  };
}

async function findExistingProjectByPriority(input: {
  githubUrl: string;
  websiteUrl?: string | null;
  title: string;
  repo: string;
}): Promise<ExistingProjectHit | null> {
  const byGithub = await prisma.project.findFirst({
    where: { deletedAt: null, githubUrl: input.githubUrl },
    select: { id: true, slug: true, name: true },
  });
  if (byGithub) {
    return { ...byGithub, reason: "githubUrl" };
  }

  const websiteUrl = input.websiteUrl?.trim() || null;
  if (websiteUrl) {
    const byWebsite = await prisma.project.findFirst({
      where: { deletedAt: null, websiteUrl },
      select: { id: true, slug: true, name: true },
    });
    if (byWebsite) {
      return { ...byWebsite, reason: "websiteUrl" };
    }
  }

  const candidateSlug = slugifyProjectName(input.title) || slugifyProjectName(input.repo);
  if (candidateSlug) {
    const bySlug = await prisma.project.findFirst({
      where: { deletedAt: null, slug: candidateSlug },
      select: { id: true, slug: true, name: true },
    });
    if (bySlug) {
      return { ...bySlug, reason: "slug" };
    }
  }

  const byName = await prisma.project.findFirst({
    where: { deletedAt: null, name: input.title.trim() },
    select: { id: true, slug: true, name: true },
  });
  if (byName) {
    return { ...byName, reason: "name" };
  }

  return null;
}

async function fetchGithubRepo(owner: string, repo: string): Promise<{
  name: string;
  description: string | null;
  homepage: string | null;
  stargazers_count: number;
  language: string | null;
}> {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_ACCESS_TOKEN?.trim() || "";
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MUHUB-Admin-Discovery",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (resp.status === 404) {
    throw new Error("项目不存在");
  }
  if (!resp.ok) {
    throw new Error(`GitHub API 请求失败（${resp.status}）`);
  }
  const data = (await resp.json()) as {
    name?: unknown;
    description?: unknown;
    homepage?: unknown;
    stargazers_count?: unknown;
    language?: unknown;
  };
  return {
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : repo,
    description: typeof data.description === "string" ? data.description.trim() || null : null,
    homepage: typeof data.homepage === "string" ? data.homepage.trim() || null : null,
    stargazers_count:
      typeof data.stargazers_count === "number" && Number.isFinite(data.stargazers_count)
        ? data.stargazers_count
        : 0,
    language: typeof data.language === "string" ? data.language.trim() || null : null,
  };
}

export async function markDiscoveryItemReviewedAction(id: string): Promise<void> {
  await updateDiscoveryStatus(id, "reviewed");
  revalidatePath(REVALIDATE);
}

export async function markDiscoveryItemRejectedAction(id: string): Promise<void> {
  await updateDiscoveryStatus(id, "rejected");
  revalidatePath(REVALIDATE);
}

export async function markDiscoveryItemNewAction(id: string): Promise<void> {
  await updateDiscoveryStatus(id, "new");
  revalidatePath(REVALIDATE);
}

export async function importDiscoveryItemAction(id: string): Promise<ImportDiscoveryItemResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "请先登录后再执行导入。" };
  }

  const item = await readDiscoveryItemById(id);
  if (!item) {
    return { ok: false, message: "条目不存在或已被删除。" };
  }

  try {
    const { slug, created, duplicated, projectId } = await importJsonDiscoveryItem(item);
    const updated = duplicated
      ? await updateDiscoveryItemDuplicateResult(id, projectId, slug)
      : await updateDiscoveryItemImportResult(id, slug);
    if (!updated) {
      return { ok: false, message: "项目已创建或已关联，但回写 JSON 队列失败，请检查 data/discovery-items.json。" };
    }
    revalidatePath(REVALIDATE);
    revalidatePath("/projects");
    revalidatePath(`/projects/${slug}`);
    return {
      ok: true,
      slug,
      message: created ? "已导入项目库并生成收录动态。" : "已关联既有项目并标记为重复线索。",
    };
  } catch (e) {
    console.error("[importDiscoveryItemAction]", e);
    const msg =
      e instanceof Error ? e.message : "导入失败，请稍后重试或查看服务器日志。";
    return { ok: false, message: msg };
  }
}

export async function runGithubDiscoveryV3Action(): Promise<RunGithubDiscoveryV3Result> {
  try {
    const summary = await runGitHubDiscoveryV3();
    revalidatePath(REVALIDATE);
    return { ok: true, summary };
  } catch (err) {
    console.error("[runGithubDiscoveryV3Action]", err);
    const raw = err instanceof Error ? err.message : String(err);
    const normalized = raw.toLowerCase();
    if (
      normalized.includes("read-only file system") ||
      normalized.includes("ero fs") ||
      normalized.includes("discovery-runtime.json")
    ) {
      return {
        ok: false,
        error: "执行失败，请联系管理员检查运行时存储配置。",
      };
    }
    return {
      ok: false,
      error: raw,
    };
  }
}

export async function runRssDiscoveryAction(): Promise<RunRssDiscoveryResult> {
  try {
    const before = (await readDiscoveryItems()).length;
    await runRssDiscovery();
    const after = (await readDiscoveryItems()).length;
    revalidatePath(REVALIDATE);
    return {
      ok: true,
      summary: { before, after, delta: Math.max(0, after - before) },
    };
  } catch (err) {
    console.error("[runRssDiscoveryAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runProjectActivityAction(): Promise<RunProjectActivityResult> {
  try {
    const summary = await runGitHubProjectActivity();
    revalidatePath(REVALIDATE);
    const created = summary.inserted.release + summary.inserted.update;
    return {
      ok: true,
      processed: summary.withGithubUrl,
      created,
    };
  } catch (err) {
    console.error("[runProjectActivityAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function getOpsEngineCandidates() {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "muhub-ops-engine"),
    path.resolve(cwd, "..", "muhub-ops-engine"),
  ];
}

async function resolveOpsEngineDir() {
  const candidates = getOpsEngineCandidates();
  for (const dir of candidates) {
    try {
      await access(dir);
      return dir;
    } catch {
      // ignore and continue
    }
  }
  return null;
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export async function runContentPipelineAction(): Promise<RunContentPipelineResult> {
  try {
    const opsEngineDir = await resolveOpsEngineDir();
    if (!opsEngineDir) {
      return { ok: false, error: "muhub-ops-engine not found" };
    }

    const npmCommand = getNpmCommand();
    const { stdout, stderr } = await execFileAsync(npmCommand, ["run", "gen:all"], {
      cwd: opsEngineDir,
      timeout: 10 * 60 * 1000,
      maxBuffer: 1024 * 1024 * 8,
      windowsHide: true,
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();

    return {
      ok: true,
      message: "Content pipeline completed",
      output,
    };
  } catch (err) {
    console.error("[runContentPipelineAction]", err);
    if (err && typeof err === "object" && "stderr" in err) {
      const stderr = String((err as { stderr?: string }).stderr ?? "").trim();
      if (stderr) {
        return { ok: false, error: stderr };
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function bulkMarkReviewedAction(ids: string[]): Promise<BulkDiscoveryStatusResult> {
  try {
    const targetIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
    let updated = 0;
    for (const id of targetIds) {
      const ok = await updateDiscoveryStatus(id, "reviewed");
      if (ok) {
        updated += 1;
      }
    }
    revalidatePath(REVALIDATE);
    return { ok: true, updated };
  } catch (err) {
    console.error("[bulkMarkReviewedAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function bulkRejectAction(ids: string[]): Promise<BulkDiscoveryStatusResult> {
  try {
    const targetIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
    let updated = 0;
    for (const id of targetIds) {
      const ok = await updateDiscoveryStatus(id, "rejected");
      if (ok) {
        updated += 1;
      }
    }
    revalidatePath(REVALIDATE);
    return { ok: true, updated };
  } catch (err) {
    console.error("[bulkRejectAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function bulkImportAction(ids: string[]): Promise<BulkImportResult> {
  try {
    const targetIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (const id of targetIds) {
      try {
        const result = await importDiscoveryItemAction(id);
        if (!result.ok) {
          failed += 1;
          continue;
        }
        if (result.message?.includes("标记为重复线索")) {
          skipped += 1;
          continue;
        }
        success += 1;
      } catch (err) {
        failed += 1;
        console.error(`[bulkImportAction:item:${id}]`, err);
      }
    }

    revalidatePath(REVALIDATE);
    return { ok: true, success, failed, skipped };
  } catch (err) {
    console.error("[bulkImportAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function parseManualGithubProjectAction(input: {
  githubUrl: string;
  websiteUrl?: string;
}): Promise<ParseManualGithubProjectResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "未配置 DATABASE_URL，无法执行解析。" };
  }
  const rawGithubUrl = input.githubUrl?.trim() || "";
  const parsed = parseRepoUrl(rawGithubUrl);
  if (!parsed || parsed.platform !== "github") {
    return { ok: false, error: "GitHub URL 无效，请输入 github.com/{owner}/{repo}" };
  }
  try {
    const normalizedGithubUrl = normalizeGithubRepoUrl(`https://github.com/${parsed.owner}/${parsed.repo}`);
    const repoData = await fetchGithubRepo(parsed.owner, parsed.repo);
    const websiteFromInput = input.websiteUrl?.trim() || "";
    const websiteUrl = websiteFromInput || repoData.homepage || null;
    const duplicate = await findExistingProjectByPriority({
      githubUrl: normalizedGithubUrl,
      websiteUrl,
      title: repoData.name,
      repo: parsed.repo,
    });
    return {
      ok: true,
      parsed: {
        githubUrl: normalizedGithubUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        title: repoData.name,
        summary: repoData.description,
        homepage: repoData.homepage,
        stargazersCount: repoData.stargazers_count,
        language: repoData.language,
      },
      duplicate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    if (message.includes("项目不存在")) {
      return { ok: false, error: "项目不存在，请检查仓库地址是否正确。" };
    }
    if (message.includes("GitHub API 请求失败")) {
      return { ok: false, error: "GitHub API 调用失败，请稍后重试。" };
    }
    return { ok: false, error: message || "解析失败，请稍后重试。" };
  }
}

export async function addManualGithubToQueueAction(input: {
  githubUrl: string;
  websiteUrl?: string;
  note?: string;
  title: string;
  summary?: string | null;
  owner?: string;
  repo?: string;
  language?: string | null;
  stargazersCount?: number;
}): Promise<AddManualGithubToQueueResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再操作。" };
  }
  const githubUrlRaw = input.githubUrl?.trim() || "";
  const parsed = parseRepoUrl(githubUrlRaw);
  if (!parsed || parsed.platform !== "github") {
    return { ok: false, error: "GitHub URL 无效，请输入 github.com/{owner}/{repo}" };
  }
  const title = input.title?.trim() || parsed.repo;
  const githubUrl = normalizeGithubRepoUrl(`https://github.com/${parsed.owner}/${parsed.repo}`);
  const duplicate = await findExistingProjectByPriority({
    githubUrl,
    websiteUrl: input.websiteUrl?.trim() || null,
    title,
    repo: parsed.repo,
  });
  if (duplicate) {
    return { ok: false, error: `该项目已存在：/projects/${duplicate.slug}` };
  }

  try {
    const item = createManualDiscoveryItem({
      githubUrl,
      websiteUrl: input.websiteUrl,
      title,
      summary: input.summary,
      note: input.note,
      language: input.language ?? null,
      stars: input.stargazersCount ?? 0,
      owner: input.owner || parsed.owner,
      repo: input.repo || parsed.repo,
    });
    const created = await appendDiscoveryItem(item);
    revalidatePath(REVALIDATE);
    return {
      ok: true,
      duplicate: created.duplicate,
      message: created.duplicate ? "已存在相同发现线索，未重复加入。" : "已加入发现队列。",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "加入发现队列失败。" };
  }
}

export async function importManualGithubProjectAction(input: {
  githubUrl: string;
  websiteUrl?: string;
  note?: string;
  title: string;
  summary?: string | null;
  owner?: string;
  repo?: string;
  language?: string | null;
  stargazersCount?: number;
}): Promise<ImportManualGithubProjectResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再操作。" };
  }
  const githubUrlRaw = input.githubUrl?.trim() || "";
  const parsed = parseRepoUrl(githubUrlRaw);
  if (!parsed || parsed.platform !== "github") {
    return { ok: false, error: "GitHub URL 无效，请输入 github.com/{owner}/{repo}" };
  }
  const title = input.title?.trim() || parsed.repo;
  const githubUrl = normalizeGithubRepoUrl(`https://github.com/${parsed.owner}/${parsed.repo}`);
  const duplicate = await findExistingProjectByPriority({
    githubUrl,
    websiteUrl: input.websiteUrl?.trim() || null,
    title,
    repo: parsed.repo,
  });
  if (duplicate) {
    return {
      ok: true,
      slug: duplicate.slug,
      duplicated: true,
      message: "该项目已存在，已跳转到已有项目。",
    };
  }

  try {
    const item = createManualDiscoveryItem({
      githubUrl,
      websiteUrl: input.websiteUrl,
      title,
      summary: input.summary,
      note: input.note,
      language: input.language ?? null,
      stars: input.stargazersCount ?? 0,
      owner: input.owner || parsed.owner,
      repo: input.repo || parsed.repo,
    });
    const result = await importJsonDiscoveryItem(item);
    revalidatePath(REVALIDATE);
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.slug}`);
    return {
      ok: true,
      slug: result.slug,
      duplicated: result.duplicated,
      message: result.created ? "已成功导入项目。" : "该项目已存在，已关联既有项目。",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "直接导入失败。" };
  }
}

export async function extractGithubProjectsFromArticleAction(input: {
  sourceName?: string;
  articleTitle?: string;
  articleBody: string;
}): Promise<ExtractGithubProjectsFromArticleResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "未配置 DATABASE_URL，暂时无法执行批量提取。" };
  }
  const body = input.articleBody?.trim() || "";
  if (!body) {
    return { ok: false, error: "请先粘贴文章正文。" };
  }
  const rawMatches = Array.from(
    body.matchAll(/((?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/[^\s)\]}>，。；;、]*)?)/gi),
    (match) => match[1] ?? "",
  ).filter(Boolean);
  const urls = extractGithubRepoUrlsFromArticleText(body);
  console.log("[extractGithubProjectsFromArticleAction] raw matches:", rawMatches);
  console.log("[extractGithubProjectsFromArticleAction] normalized matches:", urls);
  if (urls.length === 0) {
    return { ok: false, error: "正文中未识别到有效的 GitHub 仓库链接。" };
  }

  const items: BulkExtractedGithubProject[] = [];
  for (const githubUrl of urls) {
    const parsed = parseRepoUrl(githubUrl);
    if (!parsed || parsed.platform !== "github") {
      items.push({
        githubUrl,
        owner: "",
        repo: "",
        projectName: "",
        summary: null,
        stars: 0,
        language: null,
        websiteUrl: null,
        status: "error",
        errorMessage: "GitHub URL 无效",
        duplicateProject: null,
      });
      continue;
    }
    try {
      const repoData = await fetchGithubRepo(parsed.owner, parsed.repo);
      const duplicate = await findExistingProjectByPriority({
        githubUrl,
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        repo: parsed.repo,
      });
      items.push({
        githubUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        projectName: repoData.name,
        summary: repoData.description,
        stars: repoData.stargazers_count,
        language: repoData.language,
        websiteUrl: repoData.homepage,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "解析失败";
      items.push({
        githubUrl,
        owner: parsed.owner,
        repo: parsed.repo,
        projectName: parsed.repo,
        summary: null,
        stars: 0,
        language: null,
        websiteUrl: null,
        status: "error",
        errorMessage: message.includes("项目不存在")
          ? "项目不存在"
          : message.includes("GitHub API")
            ? "GitHub API 调用失败"
            : "解析失败",
        duplicateProject: null,
      });
    }
  }
  return {
    ok: true,
    items,
    totalUrls: rawMatches.length,
    uniqueRepoUrls: urls.length,
  };
}

export async function bulkAddGithubProjectsToQueueAction(input: {
  sourceName?: string;
  articleTitle?: string;
  articleBody: string;
  selectedGithubUrls: string[];
}): Promise<BulkAddGithubProjectsToQueueResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再操作。" };
  }
  const body = input.articleBody?.trim() || "";
  if (!body) {
    return { ok: false, error: "请先粘贴文章正文。" };
  }
  const allowed = new Set(extractGithubRepoUrlsFromArticleText(body));
  const selected = Array.from(
    new Set((input.selectedGithubUrls ?? []).map((x) => x.trim()).filter((x) => x && allowed.has(x))),
  );
  if (selected.length === 0) {
    return { ok: false, error: "没有可加入发现队列的项目。" };
  }

  let success = 0;
  let duplicate = 0;
  let failed = 0;
  const sourceName = input.sourceName?.trim() || null;
  const articleTitle = input.articleTitle?.trim() || null;

  for (const githubUrl of selected) {
    const parsed = parseRepoUrl(githubUrl);
    if (!parsed || parsed.platform !== "github") {
      failed += 1;
      continue;
    }
    try {
      const repoData = await fetchGithubRepo(parsed.owner, parsed.repo);
      const existing = await findExistingProjectByPriority({
        githubUrl,
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        repo: parsed.repo,
      });
      if (existing) {
        duplicate += 1;
        continue;
      }
      const item = createManualDiscoveryItem({
        githubUrl,
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        summary: repoData.description,
        language: repoData.language,
        stars: repoData.stargazers_count,
        owner: parsed.owner,
        repo: parsed.repo,
      });
      item.meta = {
        ...(item.meta ?? {}),
        source: "wechat-article",
        sourceType: "wechat",
        sourceName,
        articleTitle,
        extractedFrom: "article_text",
        githubUrl,
      };
      const appended = await appendDiscoveryItem(item);
      if (appended.duplicate) {
        duplicate += 1;
      } else {
        success += 1;
      }
    } catch {
      failed += 1;
    }
  }

  revalidatePath(REVALIDATE);
  return {
    ok: true,
    success,
    duplicate,
    failed,
    message: `批量加入完成：成功 ${success}，重复 ${duplicate}，失败 ${failed}。`,
  };
}

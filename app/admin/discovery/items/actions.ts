"use server";

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  appendDiscoveryItem,
  deleteDiscoveryItems,
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
import { isSourceMaterialDiscoveryItem } from "@/lib/discovery/mobile-capture";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { prisma } from "@/lib/prisma";
import { slugifyProjectName } from "@/lib/project-slug";
import {
  extractProjectSourceUrlsFromText,
  parseProjectSourceUrl,
} from "@/lib/project-source-url";
import { isSourceArticleUrl } from "@/lib/project-url-classifier";

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

export type BulkDeleteDiscoveryItemsResult =
  | { ok: true; deleted: number }
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
        sourceType: "GITHUB" | "GITCC";
        sourceUrl: string;
        sourceLabel: "GitHub" | "GitCC";
        githubUrl: string | null;
        owner: string | null;
        repo: string | null;
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
  sourceType: "GITHUB" | "GITCC" | "PRODUCTHUNT" | "GENERAL";
  sourceUrl: string;
  sourceLabel: "GitHub" | "GitCC" | "Product Hunt" | "通用项目";
  githubUrl: string | null;
  owner: string | null;
  repo: string | null;
  projectName: string;
  summary: string | null;
  stars: number;
  language: string | null;
  websiteUrl: string | null;
  status: "ready" | "duplicate" | "error";
  errorMessage?: string;
  duplicateProject?: { slug: string; name: string } | null;
};

type GeneralArticleProject = {
  name: string;
  summary: string | null;
  websiteUrl: string | null;
  category: string | null;
  wechatAccount: string | null;
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

// ─── 通用项目（非 GitHub）相关类型 ──────────────────────────────────────────

export type ParseGeneralProjectResult =
  | {
      ok: true;
      parsed: {
        title: string;
        summary: string | null;
        websiteUrl: string | null;
        referenceUrl: string | null;
        category: string | null;
        aiEnriched: boolean;
        wechatAccount: string | null;
        weiboUrl: string | null;
        douyinUrl: string | null;
        appStoreUrl: string | null;
        playStoreUrl: string | null;
        officialSourceCompletion: OfficialSourceCompletion[];
      };
      duplicate: ExistingProjectHit | null;
    }
  | { ok: false; error: string };

export type OfficialSourceCompletion = {
  kind: "APP_STORE" | "GOOGLE_PLAY";
  url: string;
  label: string;
  evidence: string;
  confidence: number;
};

export type AddGeneralProjectToQueueResult =
  | { ok: true; duplicate: boolean; message: string }
  | { ok: false; error: string };

export type ImportGeneralProjectResult =
  | { ok: true; slug: string; duplicated: boolean; message: string }
  | { ok: false; error: string };

export type ExtractProjectsFromUrlResult =
  | {
      ok: true;
      items: BulkExtractedGithubProject[];
      totalUrls: number;
      uniqueRepoUrls: number;
      articleTitle: string | null;
      articleBody: string;
    }
  | { ok: false; error: string };

function extractProjectSourceUrlsFromArticleText(articleBody: string): string[] {
  return extractProjectSourceUrlsFromText(articleBody).map((item) => item.source.url);
}

function firstSourceArticleUrlFromText(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s<>"'`，。；：！？、（）【】]+/gi) ?? [];
  for (const match of matches) {
    const url = match.replace(/[),.;:!?，。；：！？、）】]+$/u, "");
    if (isSourceArticleUrl(url)) {
      return url;
    }
  }
  return null;
}

function createManualDiscoveryItem(input: {
  sourceType: "GITHUB" | "GITCC";
  sourceUrl: string;
  githubUrl?: string | null;
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
  const sourceLabel = input.sourceType === "GITHUB" ? "GitHub" : "GitCC";
  return {
    id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: "manual",
    title: input.title.trim(),
    url: input.sourceUrl,
    description: input.summary?.trim() || undefined,
    status: "new",
    createdAt: now,
    meta: {
      source: input.sourceType === "GITHUB" ? "manual-github" : "manual-gitcc",
      sourceKey: input.sourceType === "GITHUB" ? "manual-github" : "manual-gitcc",
      sourceType: input.sourceType,
      sourceLabel,
      sourceUrl: input.sourceUrl,
      githubUrl: input.githubUrl ?? null,
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
  githubUrl?: string | null;
  source?: { kind: "GITHUB" | "OTHER"; url: string; label?: string | null } | null;
  websiteUrl?: string | null;
  title: string;
  repo: string;
}): Promise<ExistingProjectHit | null> {
  const githubUrl = input.githubUrl?.trim() || null;
  if (githubUrl) {
    const byGithub = await prisma.project.findFirst({
      where: { deletedAt: null, githubUrl },
      select: { id: true, slug: true, name: true },
    });
    if (byGithub) {
      return { ...byGithub, reason: "githubUrl" };
    }
  }

  if (input.source?.url) {
    const bySource = await prisma.project.findFirst({
      where: {
        deletedAt: null,
        sources: { some: { kind: input.source.kind, url: input.source.url } },
      },
      select: { id: true, slug: true, name: true },
    });
    if (bySource) {
      return { ...bySource, reason: "githubUrl" };
    }
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
  if (isSourceMaterialDiscoveryItem(item)) {
    return {
      ok: false,
      message: "该条目是待提取素材，不是项目候选。请先使用“批量提取项目”提取真实项目后再导入。",
    };
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
      return { ok: false, error: "未找到 muhub-ops-engine，请检查目录配置。" };
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
      message: "内容生成流水线已完成",
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

export async function bulkDeleteDiscoveryItemsAction(
  ids: string[],
): Promise<BulkDeleteDiscoveryItemsResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { ok: false, error: "请先登录后再操作。" };
    }
    const targetIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
    const deleted = await deleteDiscoveryItems(targetIds);
    revalidatePath(REVALIDATE);
    revalidatePath("/admin/discovery");
    revalidatePath("/admin/discovery/daily");
    return { ok: true, deleted };
  } catch (err) {
    console.error("[bulkDeleteDiscoveryItemsAction]", err);
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
  const source = parseProjectSourceUrl(rawGithubUrl);
  if (!source || (source.type !== "GITHUB" && source.type !== "GITCC")) {
    return { ok: false, error: "项目链接无效，目前支持 GitHub 和 GitCC。" };
  }
  if (source.type === "GITCC") {
    const websiteFromInput = input.websiteUrl?.trim() || "";
    const fallbackName = source.url
      .replace(/\/+$/g, "")
      .split("/")
      .filter(Boolean)
      .pop() ?? "GitCC 项目";
    const title = fallbackName || "GitCC 项目";
    const duplicate = await findExistingProjectByPriority({
      githubUrl: null,
      source: { kind: "OTHER", url: source.url, label: "GitCC" },
      websiteUrl: websiteFromInput || source.url,
      title,
      repo: title,
    });
    return {
      ok: true,
      parsed: {
        sourceType: "GITCC",
        sourceUrl: source.url,
        sourceLabel: "GitCC",
        githubUrl: null,
        owner: null,
        repo: null,
        title,
        summary: "已识别为 GitCC 来源，可直接加入发现队列或导入为外部项目。",
        homepage: source.url,
        stargazersCount: 0,
        language: null,
      },
      duplicate,
    };
  }
  if (source.type !== "GITHUB") {
    return { ok: false, error: "项目链接无效，目前支持 GitHub 和 GitCC。" };
  }
  try {
    const normalizedGithubUrl = normalizeGithubRepoUrl(source.url);
    const repoData = await fetchGithubRepo(source.owner, source.repo);
    const websiteFromInput = input.websiteUrl?.trim() || "";
    const websiteUrl = websiteFromInput || repoData.homepage || null;
    const duplicate = await findExistingProjectByPriority({
      githubUrl: normalizedGithubUrl,
      source: { kind: "GITHUB", url: normalizedGithubUrl, label: "GitHub" },
      websiteUrl,
      title: repoData.name,
      repo: source.repo,
    });
    return {
      ok: true,
      parsed: {
        sourceType: "GITHUB",
        sourceUrl: normalizedGithubUrl,
        sourceLabel: "GitHub",
        githubUrl: normalizedGithubUrl,
        owner: source.owner,
        repo: source.repo,
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
  const source = parseProjectSourceUrl(githubUrlRaw);
  if (!source || (source.type !== "GITHUB" && source.type !== "GITCC")) {
    return { ok: false, error: "项目链接无效，目前支持 GitHub 和 GitCC。" };
  }
  const githubUrl = source.type === "GITHUB" ? normalizeGithubRepoUrl(source.url) : null;
  const title =
    input.title?.trim() ||
    (source.type === "GITHUB"
      ? source.repo
      : source.url.replace(/\/+$/g, "").split("/").filter(Boolean).pop() || "GitCC 项目");
  const duplicate = await findExistingProjectByPriority({
    githubUrl,
    source:
      source.type === "GITHUB"
        ? { kind: "GITHUB", url: githubUrl!, label: "GitHub" }
        : { kind: "OTHER", url: source.url, label: "GitCC" },
    websiteUrl: input.websiteUrl?.trim() || (source.type === "GITCC" ? source.url : null),
    title,
    repo: source.repo ?? title,
  });
  if (duplicate) {
    return { ok: false, error: `该项目已存在：/projects/${duplicate.slug}` };
  }

  try {
    const item = createManualDiscoveryItem({
      sourceType: source.type,
      sourceUrl: githubUrl ?? source.url,
      githubUrl,
      websiteUrl: input.websiteUrl || (source.type === "GITCC" ? source.url : undefined),
      title,
      summary: input.summary,
      note: input.note,
      language: input.language ?? null,
      stars: input.stargazersCount ?? 0,
      owner: input.owner || source.owner || undefined,
      repo: input.repo || source.repo || undefined,
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
  const source = parseProjectSourceUrl(githubUrlRaw);
  if (!source || (source.type !== "GITHUB" && source.type !== "GITCC")) {
    return { ok: false, error: "项目链接无效，目前支持 GitHub 和 GitCC。" };
  }
  const githubUrl = source.type === "GITHUB" ? normalizeGithubRepoUrl(source.url) : null;
  const title =
    input.title?.trim() ||
    (source.type === "GITHUB"
      ? source.repo
      : source.url.replace(/\/+$/g, "").split("/").filter(Boolean).pop() || "GitCC 项目");
  const duplicate = await findExistingProjectByPriority({
    githubUrl,
    source:
      source.type === "GITHUB"
        ? { kind: "GITHUB", url: githubUrl!, label: "GitHub" }
        : { kind: "OTHER", url: source.url, label: "GitCC" },
    websiteUrl: input.websiteUrl?.trim() || (source.type === "GITCC" ? source.url : null),
    title,
    repo: source.repo ?? title,
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
      sourceType: source.type,
      sourceUrl: githubUrl ?? source.url,
      githubUrl,
      websiteUrl: input.websiteUrl || (source.type === "GITCC" ? source.url : undefined),
      title,
      summary: input.summary,
      note: input.note,
      language: input.language ?? null,
      stars: input.stargazersCount ?? 0,
      owner: input.owner || source.owner || undefined,
      repo: input.repo || source.repo || undefined,
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

  const items: BulkExtractedGithubProject[] = [];
  const seenNames = new Set<string>();

  // ── 步骤 1：URL 提取（GitHub / GitCC）────────────────────────────────────
  const extracted = extractProjectSourceUrlsFromText(body);
  console.log(
    "[extractGithubProjectsFromArticleAction] project source matches:",
    extracted.map((item) => item.source.url),
  );

  for (const { source } of extracted) {
    if (source.type === "GITCC") {
      const projectName =
        source.url.replace(/\/+$/g, "").split("/").filter(Boolean).pop() || "GitCC 项目";
      const duplicate = await findExistingProjectByPriority({
        githubUrl: null,
        source: { kind: "OTHER", url: source.url, label: "GitCC" },
        websiteUrl: source.url,
        title: projectName,
        repo: projectName,
      });
      seenNames.add(projectName.toLowerCase());
      items.push({
        sourceType: "GITCC",
        sourceUrl: source.url,
        sourceLabel: "GitCC",
        githubUrl: null,
        owner: null,
        repo: null,
        projectName,
        summary: "已识别为 GitCC 来源，可加入发现队列或导入为外部项目。",
        stars: 0,
        language: null,
        websiteUrl: source.url,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
      continue;
    }
    if (source.type === "PRODUCTHUNT") {
      const slug = source.slug || source.url.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "product";
      const projectName = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      const duplicate = await findExistingProjectByPriority({
        githubUrl: null,
        source: { kind: "OTHER", url: source.url, label: "Product Hunt" },
        websiteUrl: source.url,
        title: projectName,
        repo: projectName,
      });
      seenNames.add(projectName.toLowerCase());
      items.push({
        sourceType: "PRODUCTHUNT",
        sourceUrl: source.url,
        sourceLabel: "Product Hunt",
        githubUrl: null,
        owner: null,
        repo: null,
        projectName,
        summary: null,
        stars: 0,
        language: null,
        websiteUrl: source.url,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
      continue;
    }
    if (source.type !== "GITHUB") {
      continue;
    }
    const githubUrl = normalizeGithubRepoUrl(source.url);
    try {
      const repoData = await fetchGithubRepo(source.owner, source.repo);
      const duplicate = await findExistingProjectByPriority({
        githubUrl,
        source: { kind: "GITHUB", url: githubUrl, label: "GitHub" },
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        repo: source.repo,
      });
      seenNames.add(repoData.name.toLowerCase());
      items.push({
        sourceType: "GITHUB",
        sourceUrl: githubUrl,
        sourceLabel: "GitHub",
        githubUrl,
        owner: source.owner,
        repo: source.repo,
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
      seenNames.add(source.repo.toLowerCase());
      items.push({
        sourceType: "GITHUB",
        sourceUrl: githubUrl,
        sourceLabel: "GitHub",
        githubUrl,
        owner: source.owner,
        repo: source.repo,
        projectName: source.repo,
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

  // ── 步骤 2：AI 通用项目提取（识别文章中无代码仓库链接的产品/项目）────────
  try {
    const aiProjects = mergeGeneralArticleProjects(
      await aiExtractGeneralProjectsFromArticle(body),
      heuristicExtractGeneralProjectsFromArticle(body),
    );
    for (const proj of aiProjects) {
      if (!proj.name) continue;
      // 跳过已通过 URL 识别的项目（避免重复）
      if (seenNames.has(proj.name.toLowerCase())) continue;
      seenNames.add(proj.name.toLowerCase());
      // 去重检查
      const duplicate = await findExistingProjectByPriority({
        githubUrl: null,
        source: null,
        websiteUrl: proj.websiteUrl || null,
        title: proj.name,
        repo: proj.name,
      });
      items.push({
        sourceType: "GENERAL",
        sourceUrl: proj.websiteUrl || `general:${proj.name}`,
        sourceLabel: "通用项目",
        githubUrl: null,
        owner: null,
        repo: null,
        projectName: proj.name,
        summary: proj.summary,
        stars: 0,
        language: null,
        websiteUrl: proj.websiteUrl,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
    }
  } catch (err) {
    console.warn("[extractGithubProjectsFromArticleAction] AI 通用项目提取失败:", err);
  }

  const totalItems = extracted.length;
  const hasResults = items.length > 0;
  if (!hasResults && totalItems === 0) {
    return { ok: false, error: "正文中未识别到明确项目、产品、应用、服务或工具信息，请检查内容是否包含可收录对象。" };
  }

  return {
    ok: true,
    items,
    totalUrls: totalItems,
    uniqueRepoUrls: totalItems,
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
  // 分类：GENERAL 类型（general:名称）和 URL 类型（GitHub/GitCC）
  const allSelected = Array.from(
    new Set((input.selectedGithubUrls ?? []).map((x) => x.trim()).filter(Boolean)),
  );
  const generalSelected = allSelected.filter((x) => x.startsWith("general:"));
  const urlSelected = allSelected.filter((x) => !x.startsWith("general:"));

  // URL 类型需要从正文校验来源
  const allowed = new Set(extractProjectSourceUrlsFromArticleText(body));
  const validUrlSelected = urlSelected.filter((x) => allowed.has(x));

  const selected = [...validUrlSelected, ...generalSelected];
  if (selected.length === 0) {
    return { ok: false, error: "没有可加入发现队列的项目。" };
  }

  let success = 0;
  let duplicate = 0;
  let failed = 0;
  const sourceName = input.sourceName?.trim() || null;
  const articleTitle = input.articleTitle?.trim() || null;
  const sourceArticleUrl = firstSourceArticleUrlFromText(body);

  for (const sourceUrl of selected) {
    // ── GENERAL 通用项目（AI 识别，无代码仓库链接）────────────────────────
    if (sourceUrl.startsWith("general:")) {
      const projectName = sourceUrl.slice("general:".length).trim();
      if (!projectName) { failed += 1; continue; }
      try {
        const existing = await findExistingProjectByPriority({
          githubUrl: null,
          source: null,
          websiteUrl: null,
          title: projectName,
          repo: projectName,
        });
        if (existing) { duplicate += 1; continue; }
        const officialSourceCompletion = await completeOfficialSourcesLightly({
          title: projectName,
          summary: null,
          referenceText: body,
          appStoreUrl: null,
          playStoreUrl: null,
        });
        const appStoreUrl =
          officialSourceCompletion.find((item) => item.kind === "APP_STORE")?.url ?? null;
        const playStoreUrl =
          officialSourceCompletion.find((item) => item.kind === "GOOGLE_PLAY")?.url ?? null;
        const now = new Date().toISOString();
        const { appendDiscoveryItem: append } = await import("@/agents/discovery/discovery-store");
        const item = {
          id: `manual-general-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          sourceType: "manual" as const,
          title: projectName,
          url: `manual-general-${Date.now().toString(36)}`,
          description: undefined,
          status: "new" as const,
          createdAt: now,
          meta: {
            source: "wechat-article",
            sourceKey: "manual-general",
            sourceType: "GENERAL",
            sourceLabel: "手动添加",
            sourceUrl: null,
            githubUrl: null,
            websiteUrl: null,
            referenceUrl: sourceArticleUrl,
            note: null,
            category: null,
            language: null,
            stars: 0,
            owner: null,
            repo: null,
            sourceName,
            articleTitle,
            articleBody: body,
            sourceArticleUrl,
            extractedFrom: "ai_article_extraction",
            appStoreUrl,
            playStoreUrl,
            officialSourceCompletion,
          },
        };
        const appended = await append(item);
        if (appended.duplicate) { duplicate += 1; } else { success += 1; }
      } catch { failed += 1; }
      continue;
    }

    const source = parseProjectSourceUrl(sourceUrl);
    if (!source || (source.type !== "GITHUB" && source.type !== "GITCC" && source.type !== "PRODUCTHUNT")) {
      failed += 1;
      continue;
    }
    try {
      if (source.type === "GITCC") {
        const projectName =
          source.url.replace(/\/+$/g, "").split("/").filter(Boolean).pop() || "GitCC 项目";
        const existing = await findExistingProjectByPriority({
          githubUrl: null,
          source: { kind: "OTHER", url: source.url, label: "GitCC" },
          websiteUrl: source.url,
          title: projectName,
          repo: projectName,
        });
        if (existing) {
          duplicate += 1;
          continue;
        }
        const item = createManualDiscoveryItem({
          sourceType: "GITCC",
          sourceUrl: source.url,
          githubUrl: null,
          websiteUrl: source.url,
          title: projectName,
          summary: "已识别为 GitCC 来源，可导入为外部项目。",
          language: null,
          stars: 0,
        });
        item.meta = {
          ...(item.meta ?? {}),
          source: "wechat-article",
          sourceType: "wechat",
          sourceName,
          articleTitle,
          articleBody: body,
          sourceArticleUrl,
          extractedFrom: "article_text",
          projectSourceType: "GITCC",
          primaryProjectUrl: source.url,
          projectPageUrl: source.url,
          websiteUrl: source.url,
          externalLinks: [
            { platform: "gitcc", label: "GitCC 项目页", url: source.url, primary: true },
          ],
          sourceUrl: source.url,
        };
        const appended = await appendDiscoveryItem(item);
        if (appended.duplicate) {
          duplicate += 1;
        } else {
          success += 1;
        }
        continue;
      }

      if (source.type === "PRODUCTHUNT") {
        const slug = source.slug || source.url.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "product";
        const projectName = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const existing = await findExistingProjectByPriority({
          githubUrl: null,
          source: { kind: "OTHER", url: source.url, label: "Product Hunt" },
          websiteUrl: source.url,
          title: projectName,
          repo: projectName,
        });
        if (existing) { duplicate += 1; continue; }
        const now = new Date().toISOString();
        const phItem = {
          id: `manual-ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          sourceType: "manual" as const,
          title: projectName,
          url: source.url,
          description: undefined,
          status: "new" as const,
          createdAt: now,
          meta: {
            source: "wechat-article",
            sourceKey: "manual-producthunt",
            sourceType: "PRODUCTHUNT",
            sourceLabel: "Product Hunt",
            sourceUrl: source.url,
            githubUrl: null,
            websiteUrl: source.url,
            referenceUrl: sourceArticleUrl,
            note: null,
            category: null,
            language: null,
            stars: 0,
            owner: null,
            repo: null,
            sourceName,
            articleTitle,
            articleBody: body,
            sourceArticleUrl,
            extractedFrom: "article_text",
            primaryProjectUrl: source.url,
            projectPageUrl: source.url,
            externalLinks: [
              { platform: "producthunt", label: "Product Hunt", url: source.url, primary: true },
            ],
          },
        };
        const appended = await appendDiscoveryItem(phItem);
        if (appended.duplicate) { duplicate += 1; } else { success += 1; }
        continue;
      }
      if (source.type !== "GITHUB") {
        failed += 1;
        continue;
      }
      const githubUrl = normalizeGithubRepoUrl(source.url);
      const repoData = await fetchGithubRepo(source.owner, source.repo);
      const existing = await findExistingProjectByPriority({
        githubUrl,
        source: { kind: "GITHUB", url: githubUrl, label: "GitHub" },
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        repo: source.repo,
      });
      if (existing) {
        duplicate += 1;
        continue;
      }
      const item = createManualDiscoveryItem({
        sourceType: "GITHUB",
        sourceUrl: githubUrl,
        githubUrl,
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        summary: repoData.description,
        language: repoData.language,
        stars: repoData.stargazers_count,
        owner: source.owner,
        repo: source.repo,
      });
      item.meta = {
        ...(item.meta ?? {}),
        source: "wechat-article",
        sourceType: "wechat",
        sourceName,
        articleTitle,
        articleBody: body,
        sourceArticleUrl,
        extractedFrom: "article_text",
        githubUrl,
        primaryProjectUrl: githubUrl,
        sourceUrl: githubUrl,
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

// ─── 通用项目（非 GitHub）入库 ────────────────────────────────────────────────

/**
 * 抓取外部 URL 的纯文本内容（用于微信文章等）。
 * 仅用于站内后台，做适度抓取，超时 10 秒。
 */
/** 从 URL 抓取纯文本（支持微信文章、新闻等中文页面）。后台专用，超时 12 秒。 */
async function fetchUrlText(url: string): Promise<string | null> {
  try {
    const isWechat = url.includes("mp.weixin.qq.com");
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
    };
    if (isWechat) {
      headers["Referer"] = "https://mp.weixin.qq.com/";
      headers["Origin"] = "https://mp.weixin.qq.com";
    }
    const resp = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    // 提取 og:title / <title> 作为首行
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{2,120})["']/i)?.[1]?.trim()
      || html.match(/<title[^>]*>([^<]{2,120})<\/title>/i)?.[1]?.trim()
      || "";
    const body = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{3,}/g, "\n")
      .trim()
      .slice(0, 7500);
    return ogTitle ? `${ogTitle}\n\n${body}` : body;
  } catch {
    return null;
  }
}

/**
 * 用 AI 从文本中提取项目基本信息（名称、简介、官网、分类、中国社媒账号等）。
 * 支持：官网、公众号、微博、抖音、App Store、Google Play 等多种官方来源。
 */
async function aiExtractProjectInfo(text: string, referenceUrl?: string): Promise<{
  title: string;
  summary: string | null;
  websiteUrl: string | null;
  category: string | null;
  wechatAccount: string | null;
  weiboUrl: string | null;
  douyinUrl: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
} | null> {
  try {
    const { generateText } = await import("@/lib/ai/generate-text");
    const urlHint = referenceUrl ? `\n参考来源 URL：${referenceUrl}` : "";
    const prompt = `你是一个项目信息提取助手。请从以下文本中提取项目信息，以 JSON 格式返回，不要有任何多余内容。${urlHint}

文本内容：
${text.slice(0, 4000)}

请提取以下字段（如果找不到，填 null）：
- title：项目名称（字符串，必填）
- summary：一句话简介，50~150字（字符串或 null）
- websiteUrl：项目官网 URL，优先找官方网址（字符串或 null）
- category：项目分类，例如"AI工具"、"AI漫画"、"开发工具"、"产品/服务"等（字符串或 null）
- wechatAccount：微信公众号名称或ID（字符串或 null，注意：不是微信文章链接）
- weiboUrl：微博账号主页 URL（字符串或 null，格式如 https://weibo.com/...）
- douyinUrl：抖音账号主页 URL（字符串或 null，格式如 https://www.douyin.com/user/...）
- appStoreUrl：Apple App Store 应用链接（字符串或 null）
- playStoreUrl：Google Play 应用链接（字符串或 null）

只返回 JSON，格式如下：
{"title":"...","summary":"...","websiteUrl":"...","category":"...","wechatAccount":null,"weiboUrl":null,"douyinUrl":null,"appStoreUrl":null,"playStoreUrl":null}`;

    const raw = await generateText(prompt, {
      maxTokens: 600,
      temperature: 0.2,
      systemPrompt: "你是项目信息提取专家，只返回 JSON，不要其他内容。",
    });
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) return null;
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "",
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : null,
      websiteUrl: typeof parsed.websiteUrl === "string" && parsed.websiteUrl.startsWith("http") ? parsed.websiteUrl.trim() : null,
      category: typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.trim() : null,
      wechatAccount: typeof parsed.wechatAccount === "string" && parsed.wechatAccount.trim() ? parsed.wechatAccount.trim() : null,
      weiboUrl: typeof parsed.weiboUrl === "string" && parsed.weiboUrl.startsWith("http") ? parsed.weiboUrl.trim() : null,
      douyinUrl: typeof parsed.douyinUrl === "string" && parsed.douyinUrl.startsWith("http") ? parsed.douyinUrl.trim() : null,
      appStoreUrl: typeof parsed.appStoreUrl === "string" && parsed.appStoreUrl.startsWith("http") ? parsed.appStoreUrl.trim() : null,
      playStoreUrl: typeof parsed.playStoreUrl === "string" && parsed.playStoreUrl.startsWith("http") ? parsed.playStoreUrl.trim() : null,
    };
  } catch {
    return null;
  }
}

/**
 * 用 AI 从文章正文中批量识别所有提及的项目（不依赖 GitHub/GitCC 链接）。
 * 适用于行业报道、公众号盘点等场景，返回项目名称列表及基础信息。
 */
function normalizeProjectNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s._\-:：|｜]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function stripGenericAiToken(value: string): string {
  return value.replace(/ai|人工智能/gi, "");
}

function projectNamesCloseEnough(a: string, b: string): boolean {
  const left = normalizeProjectNameForMatch(a);
  const right = normalizeProjectNameForMatch(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftNoAi = stripGenericAiToken(left);
  const rightNoAi = stripGenericAiToken(right);
  return Boolean(
    leftNoAi &&
      rightNoAi &&
      (leftNoAi === rightNoAi || leftNoAi.includes(rightNoAi) || rightNoAi.includes(leftNoAi)),
  );
}

function appStoreCountryFromText(text: string): string {
  return /中国|国内|大陆|中文|国区|应用市场|App Store 中国/i.test(text) ? "cn" : "us";
}

function normalizeCompletionSearchTerm(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/^[：:，,。"'“”‘’「」『』【】\[\]()（）\s]+/u, "")
    .replace(/[：:，,。"'“”‘’「」『』【】\[\]()（）\s]+$/u, "")
    .trim();
}

function officialSourceSearchTerms(input: {
  title: string;
  summary: string | null;
  referenceText: string;
}): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | null | undefined) => {
    const term = normalizeCompletionSearchTerm(value ?? "");
    if (term.length < 2 || term.length > 80) return;
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    terms.push(term);
  };

  push(input.title);

  const text = `${input.summary ?? ""}\n${input.referenceText}`;
  const aliasPatterns = [
    /(?:国内版本名为|国内版(?:本)?(?:名|名称)?为|中国版(?:本)?(?:名|名称)?为|应用名为|产品名为)\s*[「『“"]\s*([\s\S]{2,80}?)\s*[」』”"]/g,
    /(?:国内版本名为|国内版(?:本)?(?:名|名称)?为|中国版(?:本)?(?:名|名称)?为|应用名为|产品名为)\s*([A-Za-z0-9\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff\s-]{1,60})/g,
  ];
  for (const pattern of aliasPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      push(match[1]);
    }
  }

  return terms.slice(0, 5);
}

async function searchAppleAppStoreOfficialSource(input: {
  term: string;
  summary: string | null;
  referenceText: string;
}): Promise<OfficialSourceCompletion | null> {
  const term = input.term.trim();
  if (!term) return null;
  try {
    const country = appStoreCountryFromText(`${input.summary ?? ""}\n${input.referenceText}`);
    const params = new URLSearchParams({
      term,
      entity: "software",
      limit: "5",
      country,
    });
    const resp = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      results?: Array<{
        trackName?: unknown;
        sellerName?: unknown;
        trackViewUrl?: unknown;
      }>;
    };
    for (const item of json.results ?? []) {
      const trackName = typeof item.trackName === "string" ? item.trackName.trim() : "";
      const trackUrl = typeof item.trackViewUrl === "string" ? item.trackViewUrl.trim() : "";
      if (!trackName || !trackUrl.startsWith("http")) continue;
      if (!projectNamesCloseEnough(term, trackName)) continue;
      const sellerName = typeof item.sellerName === "string" ? item.sellerName.trim() : "";
      return {
        kind: "APP_STORE",
        url: trackUrl,
        label: sellerName ? `App Store: ${trackName} (${sellerName})` : `App Store: ${trackName}`,
        evidence: `itunes-search term="${term}" country=${country} matched trackName="${trackName}"`,
        confidence: normalizeProjectNameForMatch(term) === normalizeProjectNameForMatch(trackName) ? 0.92 : 0.78,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function searchGooglePlayOfficialSource(input: {
  term: string;
  summary: string | null;
  referenceText: string;
}): Promise<OfficialSourceCompletion | null> {
  const term = input.term.trim();
  if (!term) return null;
  try {
    const gl = /中国|国内|大陆|中文|应用市场/i.test(`${input.summary ?? ""}\n${input.referenceText}`) ? "cn" : "us";
    const params = new URLSearchParams({
      q: term,
      c: "apps",
      hl: "en",
      gl,
    });
    const resp = await fetch(`https://play.google.com/store/search?${params.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.8,zh-CN;q=0.6",
      },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const seen = new Set<string>();
    const linkRegex = /href="(\/store\/apps\/details\?id=[^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html))) {
      const href = match[1].replace(/&amp;/g, "&");
      if (seen.has(href)) continue;
      seen.add(href);
      const index = Math.max(0, match.index - 800);
      const context = html
        .slice(index, Math.min(html.length, match.index + 800))
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
      if (!projectNamesCloseEnough(term, context)) continue;
      return {
        kind: "GOOGLE_PLAY",
        url: `https://play.google.com${href}`,
        label: `Google Play: ${term}`,
        evidence: `google-play-search term="${term}" gl=${gl} matched app details link`,
        confidence: 0.74,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function completeOfficialSourcesLightly(input: {
  title: string;
  summary: string | null;
  referenceText: string;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
}): Promise<OfficialSourceCompletion[]> {
  const shouldSearchStores = /应用市场|App Store|Google Play|play store|下载|install|download/i.test(
    `${input.title}\n${input.summary ?? ""}\n${input.referenceText}`,
  );
  const terms = officialSourceSearchTerms(input);
  if (!shouldSearchStores && terms.length <= 1) {
    return [];
  }

  const completions: OfficialSourceCompletion[] = [];
  if (!input.appStoreUrl) {
    for (const term of terms) {
      const appStore = await searchAppleAppStoreOfficialSource({ ...input, term });
      if (appStore) {
        completions.push(appStore);
        break;
      }
    }
  }
  if (!input.playStoreUrl) {
    for (const term of terms) {
      const playStore = await searchGooglePlayOfficialSource({ ...input, term });
      if (playStore) {
        completions.push(playStore);
        break;
      }
    }
  }
  return completions;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanArticleProjectName(value: string): string {
  return value
    .replace(/^[「『“"'\s]+|[」』”"'\s]+$/g, "")
    .replace(/[，,。；;：:！!？?].*$/g, "")
    .trim();
}

function summaryAround(text: string, needle: string): string | null {
  const index = text.indexOf(needle);
  if (index < 0) return null;
  return text
    .slice(index, index + 220)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || null;
}

function heuristicExtractGeneralProjectsFromArticle(text: string): GeneralArticleProject[] {
  const patterns = [
    /([A-Z][A-Za-z0-9][A-Za-z0-9._-]{1,40})(?:的出现|可以看做是|给自己的定位|进入欧美|进入日本|进入[^，。]{1,20}市场)/g,
    /(?:产品|应用|工具|项目)\s*[「『“"]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,40})\s*[」』”"]/g,
  ];
  const out: GeneralArticleProject[] = [];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const name = cleanArticleProjectName(match[1]);
      if (!name || isHttpUrl(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name,
        summary: summaryAround(text, name),
        websiteUrl: null,
        category: null,
        wechatAccount: null,
      });
    }
  }
  return out.slice(0, 8);
}

function mergeGeneralArticleProjects(
  primary: GeneralArticleProject[],
  fallback: GeneralArticleProject[],
): GeneralArticleProject[] {
  const out: GeneralArticleProject[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...fallback]) {
    const key = item.name.toLowerCase();
    if (!item.name || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function aiExtractGeneralProjectsFromArticle(text: string): Promise<GeneralArticleProject[]> {
  try {
    const { generateText } = await import("@/lib/ai/generate-text");
    const prompt = `你是一个项目/产品信息提取助手。请从以下文章正文中识别所有明确提及的产品、应用、工具或项目（不包括公司本身，只找产品/项目/工具/应用名称），以 JSON 数组格式返回，不要有任何多余内容。

文章正文：
${text.slice(0, 5000)}

请找出所有在文章中作为产品、工具或项目提及的名称（排除纯粹的公司名/机构名，除非该名称也是其核心产品名）。

对每个识别到的项目返回以下字段（找不到填 null）：
- name：项目/产品名称（必填）
- summary：在文章中的简短描述（null 或字符串）
- websiteUrl：如文章提供了官网链接（null 或字符串）
- category：产品类别如"AI漫画"、"AI视频"、"AI图像"等（null 或字符串）
- wechatAccount：微信公众号名（null 或字符串）

只返回 JSON 数组，格式如下：
[{"name":"项目A","summary":"...","websiteUrl":null,"category":"AI漫画","wechatAccount":null}]

如果找不到任何项目，返回空数组：[]`;

    const raw = await generateText(prompt, {
      maxTokens: 1500,
      temperature: 0.1,
      systemPrompt: "你是项目信息提取专家，只返回 JSON 数组，不要其他内容。",
    });
    const jsonStr = raw.match(/\[[\s\S]*\]/)?.[0];
    if (!jsonStr) return [];
    const parsed = JSON.parse(jsonStr) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "",
        summary: typeof item.summary === "string" && item.summary.trim() ? item.summary.trim() : null,
        websiteUrl: typeof item.websiteUrl === "string" && item.websiteUrl.startsWith("http") ? item.websiteUrl.trim() : null,
        category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : null,
        wechatAccount: typeof item.wechatAccount === "string" && item.wechatAccount.trim() ? item.wechatAccount.trim() : null,
      }))
      .filter((item) => item.name.length > 0);
  } catch {
    return [];
  }
}

/**
 * 解析通用项目（无需 GitHub 链接）。
 * - 如提供参考 URL（微信文章、新闻等），尝试抓取正文并 AI 分析
 * - 如提供项目名称，直接使用手填信息
 */
export async function parseGeneralProjectAction(input: {
  title?: string;
  description?: string;
  websiteUrl?: string;
  referenceUrl?: string;
}): Promise<ParseGeneralProjectResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "未配置 DATABASE_URL，无法执行解析。" };
  }

  const titleRaw = input.title?.trim() || "";
  const descRaw = input.description?.trim() || "";
  const websiteRaw = input.websiteUrl?.trim() || "";
  const refUrlInput = input.referenceUrl?.trim() || "";
  const titleLooksLikeUrl = isHttpUrl(titleRaw);
  const refUrlRaw = refUrlInput || (titleLooksLikeUrl ? titleRaw : "");

  let title = titleLooksLikeUrl ? "" : titleRaw;
  let summary: string | null = descRaw || null;
  let websiteUrl: string | null = websiteRaw || null;
  let category: string | null = null;
  let aiEnriched = false;
  let wechatAccount: string | null = null;
  let weiboUrl: string | null = null;
  let douyinUrl: string | null = null;
  let appStoreUrl: string | null = null;
  let playStoreUrl: string | null = null;
  let pageTextForCompletion = "";
  let officialSourceCompletion: OfficialSourceCompletion[] = [];

  if (refUrlRaw) {
    try {
      const pageText = await fetchUrlText(refUrlRaw);
      if (pageText && pageText.length > 100) {
        pageTextForCompletion = pageText;
        const aiResult = await aiExtractProjectInfo(pageText, refUrlRaw);
        if (aiResult) {
          if (!title && aiResult.title) title = aiResult.title;
          if (!summary && aiResult.summary) summary = aiResult.summary;
          if (!websiteUrl && aiResult.websiteUrl) websiteUrl = aiResult.websiteUrl;
          if (aiResult.category) category = aiResult.category;
          if (aiResult.wechatAccount) wechatAccount = aiResult.wechatAccount;
          if (aiResult.weiboUrl) weiboUrl = aiResult.weiboUrl;
          if (aiResult.douyinUrl) douyinUrl = aiResult.douyinUrl;
          if (aiResult.appStoreUrl) appStoreUrl = aiResult.appStoreUrl;
          if (aiResult.playStoreUrl) playStoreUrl = aiResult.playStoreUrl;
          aiEnriched = true;
        }
        if (!title) {
          const heuristicProject = heuristicExtractGeneralProjectsFromArticle(pageText)[0];
          if (heuristicProject?.name) {
            title = heuristicProject.name;
            if (!summary && heuristicProject.summary) summary = heuristicProject.summary;
          }
        }
      }
    } catch {
      // AI 分析失败，使用手填信息
    }
  }

  if (title && refUrlRaw && !(websiteUrl || wechatAccount || weiboUrl || douyinUrl || appStoreUrl || playStoreUrl)) {
    officialSourceCompletion = await completeOfficialSourcesLightly({
      title,
      summary,
      referenceText: pageTextForCompletion,
      appStoreUrl,
      playStoreUrl,
    });
    for (const completion of officialSourceCompletion) {
      if (completion.kind === "APP_STORE" && !appStoreUrl) {
        appStoreUrl = completion.url;
      }
      if (completion.kind === "GOOGLE_PLAY" && !playStoreUrl) {
        playStoreUrl = completion.url;
      }
    }
    if (officialSourceCompletion.length > 0) {
      aiEnriched = true;
    }
  }

  if (!title) {
    return { ok: false, error: "请填写项目名称，或提供可分析的参考链接。" };
  }

  // 入库校验：至少需要一个官方或第三方信息来源
  // 新闻报道链接（refUrlRaw）不算官方来源
  const hasOfficialSource = !!(websiteUrl || wechatAccount || weiboUrl || douyinUrl || appStoreUrl || playStoreUrl);
  if (!hasOfficialSource && !refUrlRaw) {
    return {
      ok: false,
      error: "项目缺少任何官方信息来源（官网、公众号、微博、抖音等），请补充后再入库。",
    };
  }

  const duplicate = await findExistingProjectByPriority({
    githubUrl: null,
    source: null,
    websiteUrl: websiteUrl || refUrlRaw || null,
    title,
    repo: title,
  });

  return {
    ok: true,
    parsed: {
      title,
      summary,
      websiteUrl,
      referenceUrl: refUrlRaw || null,
      category,
      aiEnriched,
      wechatAccount,
      weiboUrl,
      douyinUrl,
      appStoreUrl,
      playStoreUrl,
      officialSourceCompletion,
    },
    duplicate,
  };
}

/**
 * 将通用项目（无 GitHub）加入发现队列。
 * 新增：支持公众号、微博、抖音、App Store 等官方信息来源字段。
 */
export async function addGeneralProjectToQueueAction(input: {
  title: string;
  summary?: string | null;
  websiteUrl?: string | null;
  referenceUrl?: string | null;
  category?: string | null;
  note?: string;
  wechatAccount?: string | null;
  weiboUrl?: string | null;
  douyinUrl?: string | null;
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  officialSourceCompletion?: OfficialSourceCompletion[];
}): Promise<AddGeneralProjectToQueueResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再操作。" };
  }
  const title = input.title?.trim();
  if (!title) {
    return { ok: false, error: "项目名称不能为空。" };
  }

  const websiteUrl = input.websiteUrl?.trim() || null;
  const referenceUrl = input.referenceUrl?.trim() || null;
  const wechatAccount = input.wechatAccount?.trim() || null;
  const weiboUrl = input.weiboUrl?.trim() || null;
  const douyinUrl = input.douyinUrl?.trim() || null;
  const appStoreUrl = input.appStoreUrl?.trim() || null;
  const playStoreUrl = input.playStoreUrl?.trim() || null;

  // 入库校验：至少需要一个官方来源（官网、代码仓库、社媒账号等）
  // 参考链接（新闻报道等）不算官方来源
  const isProductHuntRef = /producthunt\.com\/(products|posts)\//i.test(referenceUrl ?? "");
  const hasOfficialSource = !!(websiteUrl || wechatAccount || weiboUrl || douyinUrl || appStoreUrl || playStoreUrl || isProductHuntRef);
  if (!hasOfficialSource) {
    return {
      ok: false,
      error: "项目需要至少一个官方信息来源（官网、公众号、微博、抖音、App Store 等），新闻报道不算官方来源。",
    };
  }

  const duplicate = await findExistingProjectByPriority({
    githubUrl: null,
    source: null,
    websiteUrl: websiteUrl || referenceUrl || null,
    title,
    repo: title,
  });
  if (duplicate) {
    return { ok: false, error: `该项目已存在：/projects/${duplicate.slug}` };
  }

  const now = new Date().toISOString();
  const item: DiscoveryItem = {
    id: `manual-general-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: "manual",
    title,
    url: websiteUrl || `manual-general-${Date.now().toString(36)}`,
    description: input.summary?.trim() || undefined,
    status: "new",
    createdAt: now,
    meta: {
      source: "manual-general",
      sourceKey: "manual-general",
      sourceType: "GENERAL",
      sourceLabel: "手动添加",
      sourceUrl: websiteUrl || null,
      githubUrl: null,
      websiteUrl,
      referenceUrl,
      note: input.note?.trim() || null,
      category: input.category?.trim() || null,
      language: null,
      stars: 0,
      owner: null,
      repo: null,
      wechatAccount,
      weiboUrl,
      douyinUrl,
      appStoreUrl,
      playStoreUrl,
      officialSourceCompletion: input.officialSourceCompletion ?? [],
    },
  };

  try {
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

/**
 * 将通用项目（无 GitHub）直接导入项目库。
 * 新增：支持公众号、微博、抖音等官方信息来源字段，并验证最低来源要求。
 */
export async function importGeneralProjectAction(input: {
  title: string;
  summary?: string | null;
  websiteUrl?: string | null;
  referenceUrl?: string | null;
  category?: string | null;
  note?: string;
  wechatAccount?: string | null;
  weiboUrl?: string | null;
  douyinUrl?: string | null;
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  officialSourceCompletion?: OfficialSourceCompletion[];
}): Promise<ImportGeneralProjectResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再操作。" };
  }
  const title = input.title?.trim();
  if (!title) {
    return { ok: false, error: "项目名称不能为空。" };
  }

  const websiteUrl = input.websiteUrl?.trim() || null;
  const referenceUrl = input.referenceUrl?.trim() || null;
  const wechatAccount = input.wechatAccount?.trim() || null;
  const weiboUrl = input.weiboUrl?.trim() || null;
  const douyinUrl = input.douyinUrl?.trim() || null;
  const appStoreUrl = input.appStoreUrl?.trim() || null;
  const playStoreUrl = input.playStoreUrl?.trim() || null;

  // 入库校验：至少需要一个官方来源
  const isProductHuntRef = /producthunt\.com\/(products|posts)\//i.test(referenceUrl ?? "");
  const hasOfficialSource = !!(websiteUrl || wechatAccount || weiboUrl || douyinUrl || appStoreUrl || playStoreUrl || isProductHuntRef);
  if (!hasOfficialSource) {
    return {
      ok: false,
      error: "项目需要至少一个官方信息来源（官网、公众号、微博、抖音、App Store 等）。",
    };
  }

  const duplicate = await findExistingProjectByPriority({
    githubUrl: null,
    source: null,
    websiteUrl: websiteUrl || referenceUrl || null,
    title,
    repo: title,
  });
  if (duplicate) {
    return {
      ok: true,
      slug: duplicate.slug,
      duplicated: true,
      message: "该项目已存在，已跳转到已有项目。",
    };
  }

  const now = new Date().toISOString();
  const item: DiscoveryItem = {
    id: `manual-general-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: "manual",
    title,
    url: websiteUrl || `manual-general-${Date.now().toString(36)}`,
    description: input.summary?.trim() || undefined,
    status: "new",
    createdAt: now,
    meta: {
      source: "manual-general",
      sourceKey: "manual-general",
      sourceType: "GENERAL",
      sourceLabel: "手动添加",
      sourceUrl: websiteUrl || null,
      githubUrl: null,
      websiteUrl,
      referenceUrl,
      note: input.note?.trim() || null,
      category: input.category?.trim() || null,
      language: null,
      stars: 0,
      owner: null,
      repo: null,
      wechatAccount,
      weiboUrl,
      douyinUrl,
      appStoreUrl,
      playStoreUrl,
      officialSourceCompletion: input.officialSourceCompletion ?? [],
    },
  };

  try {
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

/**
 * 从 URL（微信文章、新闻等）抓取内容，提取其中提到的项目（含 GitHub 和非 GitHub）。
 */
export async function extractProjectsFromUrlAction(input: {
  url: string;
  sourceName?: string;
}): Promise<ExtractProjectsFromUrlResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, error: "未配置 DATABASE_URL，暂时无法执行提取。" };
  }
  const url = input.url?.trim();
  if (!url || !url.startsWith("http")) {
    return { ok: false, error: "请输入有效的 URL（以 http 开头）。" };
  }

  const pageText = await fetchUrlText(url);
  if (!pageText || pageText.length < 50) {
    return { ok: false, error: "无法抓取该 URL 的内容，请检查链接是否可访问，或改为粘贴文章正文。" };
  }

  const extracted = extractProjectSourceUrlsFromText(pageText);
  const items: BulkExtractedGithubProject[] = [];

  for (const { source } of extracted) {
    if (source.type === "GITCC") {
      const projectName = source.url.replace(/\/+$/g, "").split("/").filter(Boolean).pop() || "GitCC 项目";
      const duplicate = await findExistingProjectByPriority({
        githubUrl: null,
        source: { kind: "OTHER", url: source.url, label: "GitCC" },
        websiteUrl: source.url,
        title: projectName,
        repo: projectName,
      });
      items.push({
        sourceType: "GITCC",
        sourceUrl: source.url,
        sourceLabel: "GitCC",
        githubUrl: null,
        owner: null,
        repo: null,
        projectName,
        summary: "已识别为 GitCC 来源，可加入发现队列或导入为外部项目。",
        stars: 0,
        language: null,
        websiteUrl: source.url,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
      continue;
    }
    if (source.type === "PRODUCTHUNT") {
      const slug = source.slug || source.url.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "product";
      const projectName = slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      const duplicate = await findExistingProjectByPriority({
        githubUrl: null,
        source: { kind: "OTHER", url: source.url, label: "Product Hunt" },
        websiteUrl: source.url,
        title: projectName,
        repo: projectName,
      });
      items.push({
        sourceType: "PRODUCTHUNT",
        sourceUrl: source.url,
        sourceLabel: "Product Hunt",
        githubUrl: null,
        owner: null,
        repo: null,
        projectName,
        summary: null,
        stars: 0,
        language: null,
        websiteUrl: source.url,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
      continue;
    }
    if (source.type !== "GITHUB") continue;
    const githubUrl = normalizeGithubRepoUrl(source.url);
    try {
      const repoData = await fetchGithubRepo(source.owner, source.repo);
      const duplicate = await findExistingProjectByPriority({
        githubUrl,
        source: { kind: "GITHUB", url: githubUrl, label: "GitHub" },
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        repo: source.repo,
      });
      items.push({
        sourceType: "GITHUB",
        sourceUrl: githubUrl,
        sourceLabel: "GitHub",
        githubUrl,
        owner: source.owner,
        repo: source.repo,
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
        sourceType: "GITHUB",
        sourceUrl: githubUrl,
        sourceLabel: "GitHub",
        githubUrl,
        owner: source.owner,
        repo: source.repo,
        projectName: source.repo,
        summary: null,
        stars: 0,
        language: null,
        websiteUrl: null,
        status: "error",
        errorMessage: message.includes("项目不存在") ? "项目不存在" : "GitHub API 调用失败",
        duplicateProject: null,
      });
    }
  }

  const seenNames = new Set(items.map((item) => item.projectName.toLowerCase()));
  const generalProjects = mergeGeneralArticleProjects(
    await aiExtractGeneralProjectsFromArticle(pageText),
    heuristicExtractGeneralProjectsFromArticle(pageText),
  );
  for (const proj of generalProjects) {
    if (!proj.name || seenNames.has(proj.name.toLowerCase())) continue;
    seenNames.add(proj.name.toLowerCase());
    const duplicate = await findExistingProjectByPriority({
      githubUrl: null,
      source: null,
      websiteUrl: proj.websiteUrl || null,
      title: proj.name,
      repo: proj.name,
    });
    items.push({
      sourceType: "GENERAL",
      sourceUrl: `general:${proj.name}`,
      sourceLabel: "通用项目",
      githubUrl: null,
      owner: null,
      repo: null,
      projectName: proj.name,
      summary: proj.summary,
      stars: 0,
      language: null,
      websiteUrl: proj.websiteUrl,
      status: duplicate ? "duplicate" : "ready",
      duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
    });
  }

  let articleTitle: string | null = null;
  const titleMatch = pageText.match(/(?:^|\n)([^\n]{5,80})(?:\n|$)/);
  if (titleMatch) articleTitle = titleMatch[1].trim() || null;

  return {
    ok: true,
    items,
    totalUrls: extracted.length,
    uniqueRepoUrls: extracted.length,
    articleTitle,
    articleBody: pageText,
  };
}

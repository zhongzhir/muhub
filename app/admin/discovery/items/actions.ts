"use server";

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  deleteDiscoveryItems,
  readDiscoveryItemById,
  readDiscoveryItems,
  updateDiscoveryItemDuplicateResult,
  updateDiscoveryItemImportResult,
  updateDiscoveryStatus,
} from "@/agents/discovery/discovery-store";
import { runGitHubDiscoveryV3 } from "@/agents/discovery/github/github-discovery-v3";
import { runRssDiscovery } from "@/agents/discovery/rss/rss-discovery";
import { runGitHubProjectActivity } from "@/agents/activity/github-activity";
import { importJsonDiscoveryItem } from "@/lib/discovery/import-json-queue-item";
import {
  aiExtractProjectInfo,
  completeOfficialSourcesLightly,
  extractProjectsFromArticleText,
  extractProjectsFromUrlText,
  fetchUrlText,
  heuristicExtractGeneralProjectsFromArticle,
  type ArticleExtractedProject,
  type OfficialSourceCompletion as ArticleOfficialSourceCompletion,
} from "@/lib/discovery/article-extraction";
import {
  addGeneralProjectToQueue,
  addManualGithubToQueue,
  bulkAddGithubProjectsToQueue,
  countBulkQueueSelection,
  findExistingProjectByPriority,
  importGeneralProject,
  importManualGithubProject,
  type ExistingProjectHit,
} from "@/lib/discovery/queue-projects";
import { isSourceMaterialDiscoveryItem } from "@/lib/discovery/mobile-capture";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { parseProjectSourceUrl } from "@/lib/project-source-url";

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

type BulkExtractedGithubProject = ArticleExtractedProject;

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

export type OfficialSourceCompletion = ArticleOfficialSourceCompletion;

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

  try {
    const result = await addManualGithubToQueue(input);
    if (!result.ok) {
      if (result.error === "invalid_source") {
        return { ok: false, error: "项目链接无效，目前支持 GitHub 和 GitCC。" };
      }
      return { ok: false, error: `该项目已存在：/projects/${result.duplicate.slug}` };
    }

    revalidatePath(REVALIDATE);
    return {
      ok: true,
      duplicate: result.duplicate,
      message: result.duplicate ? "已存在相同发现线索，未重复加入。" : "已加入发现队列。",
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

  try {
    const result = await importManualGithubProject(input);
    if (!result.ok) {
      return { ok: false, error: "项目链接无效，目前支持 GitHub 和 GitCC。" };
    }

    revalidatePath(REVALIDATE);
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.slug}`);
    return {
      ok: true,
      slug: result.slug,
      duplicated: result.duplicated,
      message: result.existing
        ? "该项目已存在，已跳转到已有项目。"
        : result.created
          ? "已成功导入项目。"
          : "该项目已存在，已关联既有项目。",
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

  return extractProjectsFromArticleText({
    articleBody: body,
    findExistingProject: findExistingProjectByPriority,
    fetchGithubRepo,
    logLabel: "extractGithubProjectsFromArticleAction",
  });
}

export async function bulkAddGithubProjectsToQueueAction(input: {
  sourceName?: string;
  articleTitle?: string;
  articleBody: string;
  sourceArticleUrl?: string | null;
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

  if (countBulkQueueSelection({ articleBody: body, selectedGithubUrls: input.selectedGithubUrls }) === 0) {
    return { ok: false, error: "没有可加入发现队列的项目。" };
  }

  const { success, duplicate, failed } = await bulkAddGithubProjectsToQueue({
    ...input,
    articleBody: body,
    sourceArticleUrl: input.sourceArticleUrl,
    fetchGithubRepo,
  });

  revalidatePath(REVALIDATE);
  return {
    ok: true,
    success,
    duplicate,
    failed,
    message: `批量加入完成：成功 ${success}，重复 ${duplicate}，失败 ${failed}。`,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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

  try {
    const result = await addGeneralProjectToQueue(input);
    if (!result.ok) {
      if (result.error === "empty_title") {
        return { ok: false, error: "项目名称不能为空。" };
      }
      if (result.error === "missing_official_source") {
        return {
          ok: false,
          error: "项目需要至少一个官方信息来源（官网、公众号、微博、抖音、App Store 等），新闻报道不算官方来源。",
        };
      }
      if (result.error === "existing_project") {
        return { ok: false, error: `该项目已存在：/projects/${result.duplicate.slug}` };
      }
      return { ok: false, error: "加入发现队列失败。" };
    }

    revalidatePath(REVALIDATE);
    return {
      ok: true,
      duplicate: result.duplicate,
      message: result.duplicate ? "已存在相同发现线索，未重复加入。" : "已加入发现队列。",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "加入发现队列失败。" };
  }
}

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

  try {
    const result = await importGeneralProject(input);
    if (!result.ok) {
      if (result.error === "empty_title") {
        return { ok: false, error: "项目名称不能为空。" };
      }
      return {
        ok: false,
        error: "项目需要至少一个官方信息来源（官网、公众号、微博、抖音、App Store 等）。",
      };
    }

    revalidatePath(REVALIDATE);
    revalidatePath("/projects");
    revalidatePath(`/projects/${result.slug}`);
    return {
      ok: true,
      slug: result.slug,
      duplicated: result.duplicated,
      message: result.existing
        ? "该项目已存在，已跳转到已有项目。"
        : result.created
          ? "已成功导入项目。"
          : "该项目已存在，已关联既有项目。",
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

  return extractProjectsFromUrlText({
    url,
    findExistingProject: findExistingProjectByPriority,
    fetchGithubRepo,
  });
}

import { readDiscoveryItemById, updateDiscoveryItemMeta } from "@/agents/discovery/discovery-store";
import {
  extractProjectsFromUrlText,
  type ArticleExtractedProject,
} from "@/lib/discovery/article-extraction";
import {
  bulkAddGithubProjectsToQueue,
  countBulkQueueSelection,
  findExistingProjectByPriority,
} from "@/lib/discovery/queue-projects";

export type MobileCaptureAutoExtraction =
  | {
      attempted: false;
      reason: "duplicate" | "no_url" | "not_found";
    }
  | {
      attempted: true;
      ok: true;
      articleTitle: string | null;
      totalExtracted: number;
      queued: {
        success: number;
        duplicate: number;
        failed: number;
      };
      duplicateDetails?: Array<{
        projectName: string;
        sourceUrl: string;
        slug: string;
        name: string;
      }>;
    }
  | {
      attempted: true;
      ok: false;
      error: string;
    };

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
    "User-Agent": "MUHUB-Mobile-Auto-Extract",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { method: "GET", headers, cache: "no-store" },
  );
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

function stringMeta(meta: Record<string, unknown> | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function countExtractionByStatus(items: ArticleExtractedProject[]): {
  ready: number;
  duplicate: number;
  error: number;
} {
  return {
    ready: items.filter((item) => item.status === "ready").length,
    duplicate: items.filter((item) => item.status === "duplicate").length,
    error: items.filter((item) => item.status === "error").length,
  };
}

function duplicateDetailsFromExtraction(items: ArticleExtractedProject[]): Array<{
  projectName: string;
  sourceUrl: string;
  slug: string;
  name: string;
}> {
  return items
    .filter((item) => item.status === "duplicate" && item.duplicateProject)
    .map((item) => ({
      projectName: item.projectName,
      sourceUrl: item.sourceUrl,
      slug: item.duplicateProject!.slug,
      name: item.duplicateProject!.name,
    }));
}

function buildQueuedSummary(
  items: ArticleExtractedProject[],
  queued: { success: number; duplicate: number; failed: number },
): { success: number; duplicate: number; failed: number } {
  const counts = countExtractionByStatus(items);
  return {
    success: queued.success,
    duplicate: queued.duplicate + counts.duplicate,
    failed: queued.failed + counts.error,
  };
}

export async function autoExtractProjectsFromCapturedUrl(input: {
  extractedUrl: string | null;
  sourceNote?: string | undefined;
}): Promise<MobileCaptureAutoExtraction> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { attempted: true, ok: false, error: "未配置 DATABASE_URL，暂时无法执行自动提取。" };
  }
  if (!input.extractedUrl) {
    return { attempted: false, reason: "no_url" };
  }

  const sourceName = input.sourceNote?.trim() || "mobile-capture";
  const extracted = await extractProjectsFromUrlText({
    url: input.extractedUrl,
    findExistingProject: findExistingProjectByPriority,
    fetchGithubRepo,
  });
  if (!extracted.ok) {
    return { attempted: true, ok: false, error: extracted.error };
  }

  const duplicateDetails = duplicateDetailsFromExtraction(extracted.items);
  const selectedGithubUrls = extracted.items
    .filter((item) => item.status === "ready")
    .map((item) => item.sourceUrl);

  if (selectedGithubUrls.length === 0) {
    const counts = countExtractionByStatus(extracted.items);
    return {
      attempted: true,
      ok: true,
      articleTitle: extracted.articleTitle,
      totalExtracted: extracted.items.length,
      queued: {
        success: 0,
        duplicate: counts.duplicate,
        failed: counts.error,
      },
      duplicateDetails: duplicateDetails.length > 0 ? duplicateDetails : undefined,
    };
  }

  if (
    countBulkQueueSelection({
      articleBody: extracted.articleBody,
      selectedGithubUrls,
    }) === 0
  ) {
    const counts = countExtractionByStatus(extracted.items);
    return {
      attempted: true,
      ok: true,
      articleTitle: extracted.articleTitle,
      totalExtracted: extracted.items.length,
      queued: {
        success: 0,
        duplicate: counts.duplicate,
        failed: counts.error,
      },
      duplicateDetails: duplicateDetails.length > 0 ? duplicateDetails : undefined,
    };
  }

  const queued = await bulkAddGithubProjectsToQueue({
    sourceName,
    articleTitle: extracted.articleTitle ?? undefined,
    articleBody: extracted.articleBody,
    sourceArticleUrl: input.extractedUrl,
    selectedGithubUrls,
    fetchGithubRepo,
  });

  return {
    attempted: true,
    ok: true,
    articleTitle: extracted.articleTitle,
    totalExtracted: extracted.items.length,
    queued: buildQueuedSummary(extracted.items, queued),
    duplicateDetails: duplicateDetails.length > 0 ? duplicateDetails : undefined,
  };
}

export async function persistMobileAutoExtractionResult(
  itemId: string,
  autoExtraction: MobileCaptureAutoExtraction,
): Promise<boolean> {
  const extractedAt = new Date().toISOString();
  const extractionDone =
    autoExtraction.attempted &&
    autoExtraction.ok &&
    autoExtraction.totalExtracted > 0;
  return updateDiscoveryItemMeta(itemId, {
    autoExtractionStatus: autoExtraction.attempted
      ? autoExtraction.ok
        ? "done"
        : "failed"
      : "skipped",
    autoExtractionUpdatedAt: extractedAt,
    autoExtractionReason: autoExtraction.attempted ? null : autoExtraction.reason,
    autoExtractionError:
      autoExtraction.attempted && !autoExtraction.ok ? autoExtraction.error : null,
    autoExtractionTotal:
      autoExtraction.attempted && autoExtraction.ok ? autoExtraction.totalExtracted : null,
    autoExtractionQueued:
      autoExtraction.attempted && autoExtraction.ok ? autoExtraction.queued : null,
    autoExtractionDuplicates:
      autoExtraction.attempted && autoExtraction.ok && autoExtraction.duplicateDetails?.length
        ? autoExtraction.duplicateDetails
        : null,
    needsExtraction: !extractionDone,
  });
}

export async function autoExtractMobileCaptureItemById(
  itemId: string,
): Promise<MobileCaptureAutoExtraction> {
  const item = await readDiscoveryItemById(itemId);
  if (!item) {
    return { attempted: false, reason: "not_found" };
  }
  const extractedUrl =
    stringMeta(item.meta, "sourceArticleUrl") ||
    stringMeta(item.meta, "extractedUrl") ||
    item.url;
  const sourceNote = stringMeta(item.meta, "sourceNote") || undefined;
  const result = await autoExtractProjectsFromCapturedUrl({
    extractedUrl: extractedUrl.startsWith("http") ? extractedUrl : null,
    sourceNote,
  });
  await persistMobileAutoExtractionResult(itemId, result);
  return result;
}

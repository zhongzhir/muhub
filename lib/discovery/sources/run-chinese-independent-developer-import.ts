import {
  updateDiscoveryItemImportResult,
  updateDiscoveryItemMeta,
} from "@/agents/discovery/discovery-store";
import {
  inferDiscoveryFailureKind,
  recordChineseIndieEnrichmentFailure,
  recordChineseIndieEnrichmentRetry,
  recordChineseIndieImportResultFailure,
  shouldRetryDiscoveryFailure,
} from "@/lib/discovery/chinese-indie-auto-import";
import { buildProjectEvidenceSnapshot } from "@/lib/project-evidence-snapshot";
import { importJsonDiscoveryItem } from "@/lib/discovery/import-json-queue-item";
import { generatePostImportProjectAi } from "@/lib/discovery/post-import-project-ai";
import {
  bulkQueueChineseIndependentDeveloperProjects,
  type BulkQueueChineseIndieResult,
} from "@/lib/discovery/queue-projects";
import {
  CHINESE_INDIE_DEFAULT_EDITION,
  CHINESE_INDIE_FILES,
  countEstimatedAutoImportable,
  type ChineseIndieEdition,
  fetchChineseIndependentDeveloperFiles,
  parseChineseIndependentDeveloperFiles,
  resolveChineseIndieEditions,
  shouldAutoImportChineseIndieCandidate,
  type ChineseIndieCandidateInput,
} from "@/lib/discovery/sources/chinese-independent-developer";

export type RunChineseIndependentDeveloperImportOptions = {
  dryRun?: boolean;
  autoImport?: boolean;
  limit?: number;
  offset?: number;
  edition?: ChineseIndieEdition | "all";
};

export type RunChineseIndependentDeveloperImportResult = {
  edition: ChineseIndieEdition | "all";
  includedFiles: readonly string[];
  excludedFiles: readonly string[];
  offset: number;
  limit: number | null;
  selectedRange: string;
  selectedCount: number;
  fetched: number;
  parsed: number;
  parsedByEdition: Record<ChineseIndieEdition, number>;
  fetchErrors: Array<{ edition: ChineseIndieEdition; fileName: string; error: string }>;
  queued: number;
  duplicates: BulkQueueChineseIndieResult["duplicates"];
  skippedClosed: number;
  skippedInvalid: number;
  failed: number;
  imported: number;
  importFailed: number;
  importSkipped: number;
  aiSucceeded: number;
  aiFailed: number;
  needsReview: number;
  estimatedAutoImportable: number;
  importedSlugs: string[];
  needsReviewTitles: string[];
  aiFailures: Array<{
    title: string;
    projectId: string | null;
    stage: string;
    error: string;
    stack?: string;
    failureKind?: string;
  }>;
  dryRun: boolean;
  autoImport: boolean;
  sampleDuplicates: BulkQueueChineseIndieResult["duplicates"];
};

function duplicateKey(name: string, edition: ChineseIndieEdition): string {
  return `${name.trim().toLowerCase()}::${edition}`;
}

function buildDuplicateKeySet(duplicates: BulkQueueChineseIndieResult["duplicates"]): Set<string> {
  return new Set(duplicates.map((item) => duplicateKey(item.name, item.edition)));
}

function resolveIncludedExcludedFiles(edition: ChineseIndieEdition | "all"): {
  includedFiles: string[];
  excludedFiles: string[];
} {
  if (edition === "all") {
    return {
      includedFiles: Object.values(CHINESE_INDIE_FILES),
      excludedFiles: [],
    };
  }
  const includedFiles = [CHINESE_INDIE_FILES[edition]];
  const excludedFiles = Object.values(CHINESE_INDIE_FILES).filter((file) => !includedFiles.includes(file));
  return { includedFiles, excludedFiles };
}

function sliceParsedEntries(
  entries: ChineseIndieCandidateInput[],
  offset: number,
  limit?: number,
): ChineseIndieCandidateInput[] {
  const start = Math.max(0, Math.floor(offset));
  const end = limit && limit > 0 ? start + Math.floor(limit) : undefined;
  return entries.slice(start, end);
}

function buildSelectedRange(offset: number, limit: number | undefined, total: number): string {
  if (total <= 0 || offset >= total) {
    return `${offset}-${offset - 1}`;
  }
  const end = limit && limit > 0 ? Math.min(offset + limit - 1, total - 1) : total - 1;
  return `${offset}-${end}`;
}

function readMetaNumber(meta: Record<string, unknown> | undefined, key: string): number {
  const value = meta?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function finalizeImportedItem(input: {
  item: { id: string; title: string; meta?: Record<string, unknown> };
  projectId: string;
  slug: string;
  aiResultStage: string;
}): Promise<boolean> {
  let importRetry = 0;
  let updated = false;
  while (importRetry <= 2) {
    updated = await updateDiscoveryItemImportResult(input.item.id, input.slug);
    if (updated) {
      break;
    }
    importRetry += 1;
    await sleep(400);
  }
  if (!updated) {
    const error = "导入回写失败：无法更新 discovery 队列项";
    const retryCount = readMetaNumber(input.item.meta, "retryCount") + importRetry;
    await recordChineseIndieImportResultFailure({
      discoveryItemId: input.item.id,
      projectId: input.projectId,
      slug: input.slug,
      error,
      retryCount,
    });
    return false;
  }
  const evidenceSnapshot = await buildProjectEvidenceSnapshot(input.projectId);
  await updateDiscoveryItemMeta(input.item.id, {
    aiEnrichmentStatus: "success",
    aiEnrichmentStage: "done",
    aiEnrichmentError: null,
    aiEnrichmentStack: null,
    aiEnrichmentAt: new Date().toISOString(),
    createdProjectId: input.projectId,
    importedProjectId: input.projectId,
    importedProjectSlug: input.slug,
    failureKind: null,
    importResultError: null,
    publishCompleted: true,
    needsReview: false,
    retryCount: readMetaNumber(input.item.meta, "retryCount"),
    evidenceCoverage: evidenceSnapshot?.coverage ?? null,
    evidenceConfidence: evidenceSnapshot?.confidence ?? null,
  });
  return true;
}

export async function runChineseIndependentDeveloperImport(
  options: RunChineseIndependentDeveloperImportOptions = {},
): Promise<RunChineseIndependentDeveloperImportResult> {
  const dryRun = options.dryRun === true;
  const autoImport = options.autoImport === true;
  const edition = options.edition ?? CHINESE_INDIE_DEFAULT_EDITION;
  const offset = options.offset && options.offset > 0 ? Math.floor(options.offset) : 0;
  const limit = options.limit && options.limit > 0 ? Math.floor(options.limit) : undefined;
  const { includedFiles, excludedFiles } = resolveIncludedExcludedFiles(edition);

  const fetchedFiles = await fetchChineseIndependentDeveloperFiles(resolveChineseIndieEditions(edition));
  const fetched = fetchedFiles.filter((file) => file.markdown).length;
  const { entries, parsedByEdition, errors } = parseChineseIndependentDeveloperFiles(fetchedFiles);
  const parsed = entries.length;
  const selectedEntries = sliceParsedEntries(entries, offset, limit);
  const selectedRange = buildSelectedRange(offset, limit, parsed);
  const selectedCount = selectedEntries.length;

  if (dryRun) {
    const preview = await bulkQueueChineseIndependentDeveloperProjects(selectedEntries, { dryRun: true });
    const duplicateKeys = buildDuplicateKeySet(preview.duplicates);
    return {
      edition,
      includedFiles,
      excludedFiles,
      offset,
      limit: limit ?? null,
      selectedRange,
      selectedCount,
      fetched,
      parsed,
      parsedByEdition,
      fetchErrors: errors,
      queued: preview.queued,
      duplicates: preview.duplicates,
      skippedClosed: preview.skippedClosed,
      skippedInvalid: preview.skippedInvalid,
      failed: preview.failed,
      imported: 0,
      importFailed: 0,
      importSkipped: 0,
      aiSucceeded: 0,
      aiFailed: 0,
      needsReview: 0,
      estimatedAutoImportable: countEstimatedAutoImportable(selectedEntries, duplicateKeys),
      importedSlugs: [],
      needsReviewTitles: [],
      aiFailures: [],
      dryRun: true,
      autoImport,
      sampleDuplicates: preview.duplicates.slice(0, 8),
    };
  }

  const queueResult = await bulkQueueChineseIndependentDeveloperProjects(selectedEntries);
  let imported = 0;
  let importFailed = 0;
  let importSkipped = 0;
  let aiSucceeded = 0;
  let aiFailed = 0;
  let needsReview = 0;
  const importedSlugs: string[] = [];
  const needsReviewTitles: string[] = [];
  const aiFailures: RunChineseIndependentDeveloperImportResult["aiFailures"] = [];

  if (autoImport) {
    for (const item of queueResult.items) {
      const candidate = itemToCandidateInput(item);
      if (!candidate || !shouldAutoImportChineseIndieCandidate(candidate)) {
        importSkipped += 1;
        continue;
      }
      try {
        const result = await importJsonDiscoveryItem(item, { scheduleAiEnrichment: false });
        if (!result.created || !result.projectId) {
          if (result.duplicated) {
            importSkipped += 1;
          } else {
            importFailed += 1;
          }
          continue;
        }

        let retryCount = readMetaNumber(item.meta, "retryCount");
        let aiResult = await generatePostImportProjectAi(result.projectId);
        while (!aiResult.success) {
          const error =
            aiResult.error ??
            aiResult.insightError ??
            aiResult.contentError ??
            aiResult.applyFieldsError ??
            aiResult.publishError ??
            "AI enrichment 未通过";
          const failureKind = inferDiscoveryFailureKind(aiResult.stage);
          if (shouldRetryDiscoveryFailure(failureKind, retryCount)) {
            retryCount += 1;
            await recordChineseIndieEnrichmentRetry({
              discoveryItemId: item.id,
              projectId: result.projectId,
              stage: aiResult.stage,
              error,
              failureKind,
              retryCount,
            });
            console.warn("[chinese-indie][retry]", {
              title: item.title,
              stage: aiResult.stage,
              failureKind,
              retryCount,
            });
            aiResult = await generatePostImportProjectAi(result.projectId);
            continue;
          }
          const failure = {
            title: item.title,
            projectId: result.projectId,
            stage: aiResult.stage,
            error,
            stack: aiResult.stack,
            failureKind,
          };
          aiFailures.push(failure);
          console.error("[chinese-indie][ai-failed]", failure);
          await recordChineseIndieEnrichmentFailure({
            discoveryItemId: item.id,
            projectId: result.projectId,
            title: item.title,
            stage: aiResult.stage,
            error,
            stack: aiResult.stack,
            failureKind,
          });
          aiFailed += 1;
          needsReview += 1;
          needsReviewTitles.push(item.title);
          break;
        }
        if (!aiResult.success) {
          continue;
        }

        const finalized = await finalizeImportedItem({
          item,
          projectId: result.projectId,
          slug: result.slug,
          aiResultStage: aiResult.stage,
        });
        if (!finalized) {
          const error = "导入回写失败：无法更新 discovery 队列项";
          aiFailures.push({
            title: item.title,
            projectId: result.projectId,
            stage: "import_result",
            error,
            failureKind: "infra",
          });
          console.error("[chinese-indie][import-result-failed]", {
            title: item.title,
            projectId: result.projectId,
            slug: result.slug,
          });
          importFailed += 1;
          if (readMetaNumber(item.meta, "retryCount") >= 2) {
            needsReview += 1;
            needsReviewTitles.push(item.title);
          }
          continue;
        }
        imported += 1;
        aiSucceeded += 1;
        importedSlugs.push(result.slug);
        console.info("[chinese-indie][imported]", {
          title: item.title,
          slug: result.slug,
          projectId: result.projectId,
          stage: aiResult.stage,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        aiFailures.push({
          title: item.title,
          projectId: null,
          stage: "import",
          error: message,
          stack: error instanceof Error ? error.stack?.slice(0, 400) : undefined,
          failureKind: "infra",
        });
        console.error("[chinese-indie][import-failed]", { title: item.title, error });
        importFailed += 1;
      }
    }
  }

  const duplicateKeys = buildDuplicateKeySet(queueResult.duplicates);

  return {
    edition,
    includedFiles,
    excludedFiles,
    offset,
    limit: limit ?? null,
    selectedRange,
    selectedCount,
    fetched,
    parsed,
    parsedByEdition,
    fetchErrors: errors,
    queued: queueResult.queued,
    duplicates: queueResult.duplicates,
    skippedClosed: queueResult.skippedClosed,
    skippedInvalid: queueResult.skippedInvalid,
    failed: queueResult.failed,
    imported,
    importFailed,
    importSkipped,
    aiSucceeded,
    aiFailed,
    needsReview,
    estimatedAutoImportable: countEstimatedAutoImportable(selectedEntries, duplicateKeys),
    importedSlugs,
    needsReviewTitles,
    aiFailures,
    dryRun: false,
    autoImport,
    sampleDuplicates: queueResult.duplicates.slice(0, 8),
  };
}

function itemToCandidateInput(item: {
  title: string;
  description?: string;
  meta?: Record<string, unknown>;
}): ChineseIndieCandidateInput | null {
  const meta = item.meta;
  if (!meta || meta.sourceKey !== "chinese-independent-developer") {
    return null;
  }
  const edition = meta.edition;
  const originalStatus = meta.originalStatus;
  if (
    (edition !== "main" && edition !== "programmer" && edition !== "game") ||
    (originalStatus !== "ONLINE" && originalStatus !== "DEVELOPING" && originalStatus !== "CLOSED")
  ) {
    return null;
  }
  const githubUrl = typeof meta.githubUrl === "string" ? meta.githubUrl : null;
  const websiteUrl = typeof meta.websiteUrl === "string" ? meta.websiteUrl : null;
  const sourceArticleUrl =
    typeof meta.sourceArticleUrl === "string" ? meta.sourceArticleUrl : "";
  const sourceUrl = typeof meta.sourceRepo === "string" ? meta.sourceRepo : "";
  if (!sourceArticleUrl || !sourceUrl) {
    return null;
  }
  return {
    name: item.title,
    description: item.description ?? null,
    websiteUrl,
    githubUrl,
    sourceType: "curated_repository",
    sourceName: "中国独立开发者项目列表",
    sourceUrl,
    sourceArticleUrl,
    edition,
    originalStatus,
    meta: {
      edition,
      developerName: typeof meta.developerName === "string" ? meta.developerName : "",
      developerRegion: typeof meta.developerRegion === "string" ? meta.developerRegion : null,
      developerLinks: Array.isArray(meta.developerLinks)
        ? (meta.developerLinks as ChineseIndieCandidateInput["meta"]["developerLinks"])
        : [],
      addedDate: typeof meta.addedDate === "string" ? meta.addedDate : null,
      originalStatus,
      originalMarkdown:
        typeof meta.originalMarkdown === "string" ? meta.originalMarkdown : "",
      trustLevel: "curated",
      moreInfoUrls: Array.isArray(meta.moreInfoUrls)
        ? meta.moreInfoUrls.filter((value): value is string => typeof value === "string")
        : [],
      sourceRepo: sourceUrl,
      autoImportAllowed: meta.autoImportAllowed === true,
    },
  };
}

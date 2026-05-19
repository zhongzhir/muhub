import {
  updateDiscoveryItemImportResult,
} from "@/agents/discovery/discovery-store";
import { importJsonDiscoveryItem } from "@/lib/discovery/import-json-queue-item";
import { generatePostImportProjectAi } from "@/lib/discovery/post-import-project-ai";
import {
  bulkQueueChineseIndependentDeveloperProjects,
  type BulkQueueChineseIndieResult,
} from "@/lib/discovery/queue-projects";
import {
  type ChineseIndieEdition,
  fetchChineseIndependentDeveloperFiles,
  parseChineseIndependentDeveloperFiles,
  shouldAutoImportChineseIndieCandidate,
  type ChineseIndieCandidateInput,
} from "@/lib/discovery/sources/chinese-independent-developer";

export type RunChineseIndependentDeveloperImportOptions = {
  dryRun?: boolean;
  autoImport?: boolean;
  limit?: number;
  edition?: ChineseIndieEdition | "all";
};

export type RunChineseIndependentDeveloperImportResult = {
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
  importedSlugs: string[];
  dryRun: boolean;
  autoImport: boolean;
  sampleDuplicates: BulkQueueChineseIndieResult["duplicates"];
};

function editionsFromOption(edition: ChineseIndieEdition | "all"): ChineseIndieEdition[] {
  if (edition === "all") {
    return ["main", "programmer", "game"];
  }
  return [edition];
}

export async function runChineseIndependentDeveloperImport(
  options: RunChineseIndependentDeveloperImportOptions = {},
): Promise<RunChineseIndependentDeveloperImportResult> {
  const dryRun = options.dryRun === true;
  const autoImport = options.autoImport === true;
  const edition = options.edition ?? "all";
  const limit = options.limit && options.limit > 0 ? options.limit : undefined;

  const fetchedFiles = await fetchChineseIndependentDeveloperFiles(editionsFromOption(edition));
  const fetched = fetchedFiles.filter((file) => file.markdown).length;
  const { entries, parsedByEdition, errors } = parseChineseIndependentDeveloperFiles(fetchedFiles);
  const parsed = entries.length;

  if (dryRun) {
    const preview = await bulkQueueChineseIndependentDeveloperProjects(entries, { limit, dryRun: true });
    return {
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
      importedSlugs: [],
      dryRun: true,
      autoImport,
      sampleDuplicates: preview.duplicates.slice(0, 8),
    };
  }

  const queueResult = await bulkQueueChineseIndependentDeveloperProjects(entries, { limit });
  let imported = 0;
  let importFailed = 0;
  let importSkipped = 0;
  const importedSlugs: string[] = [];

  if (autoImport) {
    for (const item of queueResult.items) {
      const candidate = itemToCandidateInput(item);
      if (!candidate || !shouldAutoImportChineseIndieCandidate(candidate)) {
        importSkipped += 1;
        continue;
      }
      try {
        const result = await importJsonDiscoveryItem(item);
        const updated = await updateDiscoveryItemImportResult(item.id, result.slug);
        if (!updated) {
          importFailed += 1;
          continue;
        }
        if (result.created && result.projectId) {
          try {
            await generatePostImportProjectAi(result.projectId);
          } catch (aiError) {
            console.error("[chinese-indie] post-import AI failed", {
              projectId: result.projectId,
              slug: result.slug,
              aiError,
            });
          }
        }
        imported += 1;
        importedSlugs.push(result.slug);
      } catch {
        importFailed += 1;
      }
    }
  }

  return {
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
    importedSlugs,
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

import {
  bulkAddGithubProjectsToQueueAction,
  extractProjectsFromUrlAction,
} from "@/app/admin/discovery/items/actions";
import { readDiscoveryItemById, updateDiscoveryItemMeta } from "@/agents/discovery/discovery-store";

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
    }
  | {
      attempted: true;
      ok: false;
      error: string;
    };

function stringMeta(meta: Record<string, unknown> | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function autoExtractProjectsFromCapturedUrl(input: {
  extractedUrl: string | null;
  sourceNote?: string | undefined;
  duplicate?: boolean;
}): Promise<MobileCaptureAutoExtraction> {
  if (input.duplicate) {
    return { attempted: false, reason: "duplicate" };
  }
  if (!input.extractedUrl) {
    return { attempted: false, reason: "no_url" };
  }

  const sourceName = input.sourceNote?.trim() || "mobile-capture";
  const extracted = await extractProjectsFromUrlAction({
    url: input.extractedUrl,
    sourceName,
  });
  if (!extracted.ok) {
    return { attempted: true, ok: false, error: extracted.error };
  }

  const selectedGithubUrls = extracted.items
    .filter((item) => item.status === "ready")
    .map((item) => item.sourceUrl);
  if (selectedGithubUrls.length === 0) {
    return {
      attempted: true,
      ok: true,
      articleTitle: extracted.articleTitle,
      totalExtracted: extracted.items.length,
      queued: { success: 0, duplicate: 0, failed: 0 },
    };
  }

  const queued = await bulkAddGithubProjectsToQueueAction({
    sourceName,
    articleTitle: extracted.articleTitle ?? undefined,
    articleBody: extracted.articleBody,
    selectedGithubUrls,
  });
  if (!queued.ok) {
    return { attempted: true, ok: false, error: queued.error };
  }

  return {
    attempted: true,
    ok: true,
    articleTitle: extracted.articleTitle,
    totalExtracted: extracted.items.length,
    queued: {
      success: queued.success,
      duplicate: queued.duplicate,
      failed: queued.failed,
    },
  };
}

export async function persistMobileAutoExtractionResult(
  itemId: string,
  autoExtraction: MobileCaptureAutoExtraction,
): Promise<boolean> {
  const extractedAt = new Date().toISOString();
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
    needsExtraction: !(autoExtraction.attempted && autoExtraction.ok && autoExtraction.totalExtracted > 0),
  });
}

export async function autoExtractMobileCaptureItemById(
  itemId: string,
): Promise<MobileCaptureAutoExtraction> {
  const item = await readDiscoveryItemById(itemId);
  if (!item) {
    return { attempted: false, reason: "not_found" };
  }
  const extractedUrl = stringMeta(item.meta, "extractedUrl") || item.url;
  const sourceNote = stringMeta(item.meta, "sourceNote") || undefined;
  const result = await autoExtractProjectsFromCapturedUrl({
    extractedUrl: extractedUrl.startsWith("http") ? extractedUrl : null,
    sourceNote,
  });
  await persistMobileAutoExtractionResult(itemId, result);
  return result;
}

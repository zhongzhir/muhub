import {
  updateDiscoveryItemMeta,
  updateDiscoveryStatus,
} from "@/agents/discovery/discovery-store";
import { prisma } from "@/lib/prisma";

export type DiscoveryFailureKind = "ai" | "infra" | "validation" | "duplicate";

export function inferDiscoveryFailureKind(stage: string): DiscoveryFailureKind {
  if (stage === "apply_fields" || stage === "publish") {
    return "validation";
  }
  if (stage === "import" || stage === "import_result") {
    return "infra";
  }
  if (stage === "duplicate") {
    return "duplicate";
  }
  if (stage === "evidence" || stage === "website_evidence") {
    return "infra";
  }
  return "ai";
}

export function maxDiscoveryRetries(failureKind: DiscoveryFailureKind): number {
  if (failureKind === "infra") {
    return 2;
  }
  if (failureKind === "ai") {
    return 1;
  }
  return 0;
}

export function shouldRetryDiscoveryFailure(
  failureKind: DiscoveryFailureKind,
  retryCount: number,
): boolean {
  return retryCount < maxDiscoveryRetries(failureKind);
}

export type ChineseIndieEnrichmentFailureInput = {
  discoveryItemId: string;
  projectId: string;
  title?: string;
  stage: string;
  error: string;
  stack?: string;
  failureKind?: DiscoveryFailureKind;
};

export async function recordChineseIndieEnrichmentFailure(
  input: ChineseIndieEnrichmentFailureInput,
): Promise<void> {
  const message = input.error.slice(0, 500);
  const stackSnippet = input.stack?.slice(0, 400) ?? null;
  const failureKind = input.failureKind ?? inferDiscoveryFailureKind(input.stage);
  await prisma.project.update({
    where: { id: input.projectId },
    data: { deletedAt: new Date() },
  });
  await updateDiscoveryItemMeta(input.discoveryItemId, {
    aiEnrichmentStatus: "failed",
    aiEnrichmentStage: input.stage,
    aiEnrichmentError: message,
    aiEnrichmentStack: stackSnippet,
    aiEnrichmentAt: new Date().toISOString(),
    createdProjectId: input.projectId,
    importedProjectId: input.projectId,
    failureKind,
    needsReview: true,
    publishCompleted: false,
  });
  await updateDiscoveryStatus(input.discoveryItemId, "reviewed");
}

export async function recordChineseIndieEnrichmentRetry(input: {
  discoveryItemId: string;
  projectId: string;
  stage: string;
  error: string;
  failureKind: DiscoveryFailureKind;
  retryCount: number;
}): Promise<void> {
  await updateDiscoveryItemMeta(input.discoveryItemId, {
    aiEnrichmentStatus: "retrying",
    aiEnrichmentStage: input.stage,
    aiEnrichmentError: input.error.slice(0, 500),
    aiEnrichmentAt: new Date().toISOString(),
    createdProjectId: input.projectId,
    importedProjectId: input.projectId,
    failureKind: input.failureKind,
    retryCount: input.retryCount,
    lastRetryAt: new Date().toISOString(),
    needsReview: false,
  });
}

export type ChineseIndieImportResultFailureInput = {
  discoveryItemId: string;
  projectId: string;
  slug: string;
  error: string;
  retryCount?: number;
};

/** publish / AI 已成功，但队列 imported 回写失败 */
export async function recordChineseIndieImportResultFailure(
  input: ChineseIndieImportResultFailureInput,
): Promise<void> {
  const message = input.error.slice(0, 500);
  const retryCount = input.retryCount ?? 0;
  const canRetry = shouldRetryDiscoveryFailure("infra", retryCount);
  await updateDiscoveryItemMeta(input.discoveryItemId, {
    aiEnrichmentStatus: canRetry ? "retrying" : "success",
    aiEnrichmentStage: "done",
    aiEnrichmentError: canRetry ? message : null,
    aiEnrichmentStack: null,
    aiEnrichmentAt: new Date().toISOString(),
    createdProjectId: input.projectId,
    importedProjectId: input.projectId,
    importedProjectSlug: input.slug,
    failureKind: "infra",
    importResultError: message,
    publishCompleted: true,
    retryCount,
    lastRetryAt: new Date().toISOString(),
    needsReview: !canRetry,
  });
  if (!canRetry) {
    await updateDiscoveryStatus(input.discoveryItemId, "reviewed");
  }
}

/** @deprecated use recordChineseIndieEnrichmentFailure */
export async function rollbackChineseIndieAutoImport(input: {
  discoveryItemId: string;
  projectId: string;
  error: string;
  stage?: string;
  title?: string;
  stack?: string;
}): Promise<void> {
  await recordChineseIndieEnrichmentFailure({
    discoveryItemId: input.discoveryItemId,
    projectId: input.projectId,
    title: input.title,
    stage: input.stage ?? "unknown",
    error: input.error,
    stack: input.stack,
  });
}

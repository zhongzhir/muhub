import { runDiscoveryScheduledJob } from "@/agents/discovery/scheduler/discovery-scheduler";
import { prisma } from "@/lib/prisma";
import { runDiscoveryClassification } from "@/lib/discovery/classification/run-classification";
import { runDiscoveryEnrichment } from "@/lib/discovery/enrichment/run-enrichment-job";
import { persistReviewPriorityForCandidateId } from "@/lib/discovery/persist-review-priority";
import { isPublishingDiscoveryPipelineEnabled } from "@/lib/discovery/discovery-feature-flags";
import { runPublishingDiscoveryPipeline } from "@/lib/discovery/publishing/publishing-discovery-pipeline";
import type { Prisma } from "@prisma/client";

export type DailyDiscoveryWorkflowOptions = {
  candidateLimit?: number;
  runSources?: boolean;
  runEnrichment?: boolean;
  runClassification?: boolean;
};

export type DailyDiscoveryWorkflowSummary = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  sources: Awaited<ReturnType<typeof runDiscoveryScheduledJob>> | null;
  publishingPipeline: Awaited<ReturnType<typeof runPublishingDiscoveryPipeline>> | null;
  candidates: {
    scanned: number;
    enriched: number;
    classified: number;
    priorityRecomputed: number;
    failed: Array<{ id: string; stage: "enrichment" | "classification" | "priority"; error: string }>;
  };
};

function limitFromOptions(options: DailyDiscoveryWorkflowOptions): number {
  return Math.min(50, Math.max(1, options.candidateLimit ?? 20));
}

export async function runDailyDiscoveryWorkflow(
  options: DailyDiscoveryWorkflowOptions = {},
): Promise<DailyDiscoveryWorkflowSummary> {
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const runSources = options.runSources ?? true;
  const runEnrichment = options.runEnrichment ?? true;
  const runClassification = options.runClassification ?? true;
  const candidateLimit = limitFromOptions(options);

  const sources = runSources ? await runDiscoveryScheduledJob() : null;
  const publishingPipeline =
    runSources && isPublishingDiscoveryPipelineEnabled()
      ? await runPublishingDiscoveryPipeline({ delayMs: 600 })
      : null;
  const candidateWork: Prisma.DiscoveryCandidateWhereInput[] = [{ reviewPriorityScore: 0 }];
  if (runEnrichment) {
    candidateWork.push({ enrichmentStatus: "PENDING" });
  }
  if (runClassification) {
    candidateWork.push({ classificationStatus: "PENDING" });
  }

  const candidates = await prisma.discoveryCandidate.findMany({
    where: {
      reviewStatus: "PENDING",
      importStatus: "PENDING",
      OR: candidateWork,
    },
    select: {
      id: true,
      enrichmentStatus: true,
      classificationStatus: true,
    },
    orderBy: [
      { reviewPriorityScore: "desc" },
      { firstSeenAt: "desc" },
    ],
    take: candidateLimit,
  });

  let enriched = 0;
  let classified = 0;
  let priorityRecomputed = 0;
  const failed: DailyDiscoveryWorkflowSummary["candidates"]["failed"] = [];

  for (const candidate of candidates) {
    if (runEnrichment && candidate.enrichmentStatus === "PENDING") {
      try {
        const result = await runDiscoveryEnrichment(candidate.id);
        if (result.ok) {
          enriched += 1;
        } else if (result.error) {
          failed.push({ id: candidate.id, stage: "enrichment", error: result.error });
        }
      } catch (error) {
        failed.push({
          id: candidate.id,
          stage: "enrichment",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (runClassification && candidate.classificationStatus === "PENDING") {
      try {
        const result = await runDiscoveryClassification(candidate.id);
        if (result.ok) {
          classified += 1;
        } else if (result.error) {
          failed.push({ id: candidate.id, stage: "classification", error: result.error });
        }
      } catch (error) {
        failed.push({
          id: candidate.id,
          stage: "classification",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await persistReviewPriorityForCandidateId(prisma, candidate.id);
      priorityRecomputed += 1;
    } catch (error) {
      failed.push({
        id: candidate.id,
        stage: "priority",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const finishedAtMs = Date.now();
  return {
    startedAt,
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    sources,
    publishingPipeline,
    candidates: {
      scanned: candidates.length,
      enriched,
      classified,
      priorityRecomputed,
      failed,
    },
  };
}

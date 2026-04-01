import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeReviewPriority } from "@/lib/discovery/review-priority";

type DbClient = Pick<PrismaClient, "discoveryCandidate">;

const SELECT_FOR_PRIORITY = {
  id: true,
  externalType: true,
  sourceKey: true,
  metadataJson: true,
  website: true,
  repoUrl: true,
  docsUrl: true,
  enrichmentStatus: true,
  classificationStatus: true,
  isAiRelated: true,
  score: true,
  qualityScore: true,
  stars: true,
  repoUpdatedAt: true,
  lastCommitAt: true,
  reviewStatus: true,
  importStatus: true,
} as const;

export async function persistReviewPriorityForCandidateId(
  db: DbClient,
  candidateId: string,
): Promise<void> {
  const row = await db.discoveryCandidate.findUnique({
    where: { id: candidateId },
    select: SELECT_FOR_PRIORITY,
  });
  if (!row) {
    return;
  }
  const { reviewPriorityScore, reviewPrioritySignals } = computeReviewPriority({
    externalType: row.externalType,
    sourceKey: row.sourceKey,
    metadataJson: row.metadataJson,
    website: row.website,
    repoUrl: row.repoUrl,
    docsUrl: row.docsUrl,
    enrichmentStatus: row.enrichmentStatus,
    classificationStatus: row.classificationStatus,
    isAiRelated: row.isAiRelated,
    score: row.score,
    qualityScore: row.qualityScore,
    stars: row.stars,
    repoUpdatedAt: row.repoUpdatedAt,
    lastCommitAt: row.lastCommitAt,
    reviewStatus: row.reviewStatus,
    importStatus: row.importStatus,
  });

  await db.discoveryCandidate.update({
    where: { id: candidateId },
    data: {
      reviewPriorityScore,
      reviewPrioritySignals: reviewPrioritySignals as Prisma.InputJsonValue,
    },
  });
}

/** 批量重算（优先 updatedAt 较早的排片），用于历史数据迁移 */
export async function recomputeDiscoveryReviewPriorityBatch(
  limit: number,
): Promise<{ updated: number }> {
  const take = Math.min(500, Math.max(1, limit));
  const rows = await prisma.discoveryCandidate.findMany({
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take,
  });
  for (const r of rows) {
    await persistReviewPriorityForCandidateId(prisma, r.id);
  }
  return { updated: rows.length };
}

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { persistReviewPriorityForCandidateId } from "@/lib/discovery/persist-review-priority";
import { classifyDiscoveryCandidate } from "./classify-candidate";

export type RunClassificationResult = {
  ok: boolean;
  jobId: string;
  error?: string;
  logs?: string[];
};

export async function runDiscoveryClassification(
  candidateId: string,
): Promise<RunClassificationResult> {
  const logs: string[] = [];
  const row = await prisma.discoveryCandidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      title: true,
      summary: true,
      descriptionRaw: true,
      tagsJson: true,
      website: true,
      docsUrl: true,
      repoUrl: true,
      language: true,
      enrichmentLinks: { select: { platform: true, url: true } },
    },
  });
  if (!row) {
    return { ok: false, jobId: "", error: "候选不存在" };
  }

  const job = await prisma.discoveryClassificationJob.create({
    data: { candidateId, status: "RUNNING", logJson: [] },
  });
  logs.push(`[job] ${job.id} started`);

  try {
    const result = classifyDiscoveryCandidate({
      title: row.title,
      summary: row.summary,
      descriptionRaw: row.descriptionRaw,
      tagsJson: row.tagsJson,
      website: row.website,
      docsUrl: row.docsUrl,
      repoUrl: row.repoUrl,
      language: row.language,
      enrichmentLinks: row.enrichmentLinks,
    });

    await prisma.discoveryCandidate.update({
      where: { id: candidateId },
      data: {
        suggestedType: result.suggestedType,
        suggestedTagsJson: result.suggestedTags as unknown as Prisma.InputJsonValue,
        classificationStatus: "DONE",
        classificationScore: result.classificationScore,
        classificationEvidenceJson: result.evidence as unknown as Prisma.InputJsonValue,
        isAiRelated: result.isAiRelated,
        isChineseTool: result.isChineseTool,
      },
    });

    await persistReviewPriorityForCandidateId(prisma, candidateId);

    logs.push(`[job] type=${result.suggestedType} tags=${result.suggestedTags.length}`);
    await prisma.discoveryClassificationJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        logJson: logs as unknown as Prisma.InputJsonValue,
      },
    });
    return { ok: true, jobId: job.id, logs };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logs.push(`[job] FATAL ${msg}`);
    await prisma.discoveryClassificationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: msg,
        logJson: logs as unknown as Prisma.InputJsonValue,
      },
    });
    await prisma.discoveryCandidate.update({
      where: { id: candidateId },
      data: { classificationStatus: "FAILED" },
    });
    await persistReviewPriorityForCandidateId(prisma, candidateId);
    return { ok: false, jobId: job.id, error: msg, logs };
  }
}

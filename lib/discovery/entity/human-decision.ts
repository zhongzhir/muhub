import type { Prisma } from "@prisma/client";
import { appendDiscoveryFeedbackRecord, type DiscoveryFeedbackDecision, type DiscoveryFeedbackReasonTag } from "@/lib/discovery/feedback-capture";
import { prisma } from "@/lib/prisma";

export type EntityHumanDecisionInput = {
  entityHintId: string;
  decision: DiscoveryFeedbackDecision;
  finalStatus?: string | null;
  finalEntityType?: string | null;
  finalPrimarySource?: string | null;
  reasonTags?: DiscoveryFeedbackReasonTag[];
  comment?: string | null;
  operator?: string | null;
  reviewer?: string | null;
  isHighValue?: boolean | null;
  shouldTrackLongTerm?: boolean | null;
};

function sourceLevelFromEvidence(evidenceJson: unknown): string | null {
  if (!evidenceJson || typeof evidenceJson !== "object" || Array.isArray(evidenceJson)) {
    return null;
  }
  const raw = (evidenceJson as Record<string, unknown>).sourceLevel;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function decisionToStatus(decision: DiscoveryFeedbackDecision): string | null {
  if (decision === "ACCEPT") {
    return "ACCEPTED";
  }
  if (decision === "REJECT") {
    return "REJECTED";
  }
  if (decision === "NEEDS_REVIEW") {
    return "PENDING";
  }
  if (decision === "MERGE") {
    return "MERGED_LATER";
  }
  return null;
}

export async function recordEntityHumanDecision(
  input: EntityHumanDecisionInput,
): Promise<{ feedbackId: string; datasetRecordId: string }> {
  const hint = await prisma.entityHint.findUnique({
    where: { id: input.entityHintId },
    select: {
      id: true,
      name: true,
      entityType: true,
      status: true,
      sourceUrl: true,
      sourceTitle: true,
      sourceTextSnippet: true,
      evidenceJson: true,
      confidence: true,
      sourceSignalId: true,
    },
  });

  if (!hint) {
    throw new Error("Entity Hint not found");
  }

  const finalStatus = input.finalStatus ?? decisionToStatus(input.decision) ?? hint.status;
  const finalEntityType = input.finalEntityType?.trim() || hint.entityType;
  const finalPrimarySource = input.finalPrimarySource?.trim() || hint.sourceUrl || null;
  const sourceLevel = sourceLevelFromEvidence(hint.evidenceJson) ?? "secondary";

  const datasetRecord = await appendDiscoveryFeedbackRecord({
    entityHintId: hint.id,
    entityName: hint.name,
    originalEntityType: hint.entityType,
    finalEntityType,
    originalStatus: hint.status,
    finalStatus,
    originalDecision: null,
    finalDecision: input.decision,
    originalPrimarySource: hint.sourceUrl ?? null,
    finalPrimarySource,
    sourceUrl: hint.sourceUrl ?? null,
    sourceTitle: hint.sourceTitle ?? null,
    sourceLevel,
    isHumanDecision: true,
    decisionSource: "entity_queue",
    reasonTags: input.reasonTags ?? [],
    comment: input.comment ?? null,
    authenticityScore:
      typeof hint.confidence === "number" ? Math.round(hint.confidence * 100) : null,
    operator: input.operator ?? "operator",
    context: {
      discoveryItemId: hint.sourceSignalId ?? hint.id,
      source: "discovery_item",
    },
    evidence: hint.sourceUrl
      ? [
          {
            url: hint.sourceUrl,
            sourceLevel,
            evidenceRole: hint.sourceTitle ?? "source_signal",
          },
        ]
      : undefined,
  });

  const feedback = await prisma.$transaction(async (tx) => {
    const row = await tx.entityHintFeedback.create({
      data: {
        entityHintId: hint.id,
        action: input.decision,
        reviewer: input.reviewer ?? "operator",
        feedbackReason: input.comment?.trim() || null,
        feedbackTags: (input.reasonTags ?? []) as unknown as Prisma.InputJsonValue,
        isHighValue: input.isHighValue ?? null,
        shouldTrackLongTerm: input.shouldTrackLongTerm ?? null,
        notes: input.comment?.trim() || null,
      },
      select: { id: true },
    });

    await tx.entityHint.update({
      where: { id: hint.id },
      data: {
        status: finalStatus,
        entityType: finalEntityType,
        sourceUrl: finalPrimarySource,
      },
    });

    return row;
  });

  return { feedbackId: feedback.id, datasetRecordId: datasetRecord.id };
}

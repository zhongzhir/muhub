import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  hintStatusForFeedbackAction,
  isEntityHintFeedbackAction,
  isEntityHintFeedbackReviewer,
  parseFeedbackTags,
  type EntityHintFeedbackAction,
  type EntityHintFeedbackReviewer,
  type EntityHintFeedbackTag,
} from "@/lib/discovery/entity/feedback-types";

export type SubmitEntityHintFeedbackInput = {
  entityHintId: string;
  action: EntityHintFeedbackAction;
  reviewer?: EntityHintFeedbackReviewer;
  feedbackReason?: string | null;
  feedbackTags?: EntityHintFeedbackTag[];
  confidenceAdjustment?: number | null;
  isHighValue?: boolean | null;
  shouldTrackLongTerm?: boolean | null;
  notes?: string | null;
};

export async function submitEntityHintFeedback(
  input: SubmitEntityHintFeedbackInput,
): Promise<{ id: string }> {
  if (!isEntityHintFeedbackAction(input.action)) {
    throw new Error(`Invalid feedback action: ${input.action}`);
  }

  const reviewer =
    input.reviewer && isEntityHintFeedbackReviewer(input.reviewer)
      ? input.reviewer
      : "operator";

  const hint = await prisma.entityHint.findUnique({
    where: { id: input.entityHintId },
    select: { id: true },
  });
  if (!hint) {
    throw new Error("EntityHint 不存在");
  }

  const nextStatus = hintStatusForFeedbackAction(input.action);

  const feedback = await prisma.$transaction(async (tx) => {
    const row = await tx.entityHintFeedback.create({
      data: {
        entityHintId: input.entityHintId,
        action: input.action,
        reviewer,
        feedbackReason: input.feedbackReason?.trim() || null,
        feedbackTags: (input.feedbackTags ?? []) as unknown as Prisma.InputJsonValue,
        confidenceAdjustment:
          typeof input.confidenceAdjustment === "number" ? input.confidenceAdjustment : null,
        isHighValue: input.isHighValue ?? null,
        shouldTrackLongTerm: input.shouldTrackLongTerm ?? null,
        notes: input.notes?.trim() || null,
      },
      select: { id: true },
    });

    if (nextStatus) {
      await tx.entityHint.update({
        where: { id: input.entityHintId },
        data: { status: nextStatus },
      });
    }

    return row;
  });

  return feedback;
}

export async function listEntityHintFeedback(entityHintId: string, limit = 20) {
  const rows = await prisma.entityHintFeedback.findMany({
    where: { entityHintId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    ...row,
    feedbackTags: parseFeedbackTags(row.feedbackTags),
  }));
}

export type FeedbackDatasetRow = {
  signalTitle: string;
  snippet: string;
  entityName: string;
  entityType: string;
  action: string;
  feedbackTags: string[];
  feedbackReason: string | null;
  notes: string | null;
  isHighValue: boolean | null;
  shouldTrackLongTerm: boolean | null;
  sourceType: string | null;
  sourceAuthority: string | null;
  scope: string[];
  reviewer: string;
  createdAt: string;
};

export async function loadFeedbackDatasetRows(limit = 5000): Promise<FeedbackDatasetRow[]> {
  const rows = await prisma.entityHintFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      entityHint: {
        include: {
          sourceSignal: {
            select: {
              title: true,
              summary: true,
              sourceType: true,
              metadataJson: true,
              source: { select: { configJson: true } },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const hint = row.entityHint;
    const signal = hint.sourceSignal;
    const configJson = signal?.source?.configJson;
    let sourceAuthority: string | null = null;
    if (configJson && typeof configJson === "object" && !Array.isArray(configJson)) {
      const tier = (configJson as Record<string, unknown>).sourceAuthorityTier;
      sourceAuthority = typeof tier === "string" ? tier : null;
    }

    const scopes = Array.isArray(hint.discoveryScopes)
      ? (hint.discoveryScopes as unknown[]).filter((s): s is string => typeof s === "string")
      : [];

    return {
      signalTitle: signal?.title ?? hint.sourceTitle ?? "",
      snippet: hint.sourceTextSnippet ?? signal?.summary ?? "",
      entityName: hint.name,
      entityType: hint.entityType,
      action: row.action,
      feedbackTags: parseFeedbackTags(row.feedbackTags),
      feedbackReason: row.feedbackReason,
      notes: row.notes,
      isHighValue: row.isHighValue,
      shouldTrackLongTerm: row.shouldTrackLongTerm,
      sourceType: signal?.sourceType ?? null,
      sourceAuthority,
      scope: scopes,
      reviewer: row.reviewer,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

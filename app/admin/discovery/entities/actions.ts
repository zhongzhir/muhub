"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  appendDiscoveryFeedbackRecord,
  type DiscoveryFeedbackDecision,
  type DiscoveryFeedbackReasonTag,
} from "@/lib/discovery/feedback-capture";
import { submitEntityHintFeedback } from "@/lib/discovery/entity/feedback-crud";
import {
  isEntityHintFeedbackAction,
  parseFeedbackTags,
  type EntityHintFeedbackAction,
  type EntityHintFeedbackTag,
} from "@/lib/discovery/entity/feedback-types";
import { isEntityHintStatus } from "@/lib/discovery/entity/types";
import { prisma } from "@/lib/prisma";

type ActionResult = { ok: true } | { ok: false; error: string };

export type SubmitEntityHintFeedbackPayload = {
  hintId: string;
  action: EntityHintFeedbackAction;
  feedbackTags?: EntityHintFeedbackTag[];
  feedbackReason?: string;
  notes?: string;
  finalEntityType?: string;
  finalPrimarySource?: string;
  isHighValue?: boolean;
  shouldTrackLongTerm?: boolean;
};

function mapActionToDiscoveryDecision(action: EntityHintFeedbackAction): DiscoveryFeedbackDecision {
  if (action === "UNSURE") {
    return "NEEDS_REVIEW";
  }
  if (action === "NEEDS_REVIEW") {
    return "NEEDS_REVIEW";
  }
  return action;
}

function mapReasonTags(tags: EntityHintFeedbackTag[]): DiscoveryFeedbackReasonTag[] {
  const allowed = new Set([
    "official_source_exists",
    "github_exists",
    "huggingface_exists",
    "website_exists",
    "multi_source_verified",
    "high_project_value",
    "high_industry_attention",
    "concept_only",
    "method_only",
    "no_official_source",
    "ambiguous_name",
    "duplicate_project",
    "insufficient_information",
    "ai_misidentified",
    "found_more_trusted_source",
    "official_source",
    "github_source",
    "huggingface_source",
    "website_source",
    "other",
  ]);
  const mapped = tags.filter((tag): tag is DiscoveryFeedbackReasonTag => allowed.has(tag));
  if (mapped.length > 0) {
    return mapped;
  }
  return tags.length > 0 ? ["other"] : [];
}

async function appendEntityHintDiscoveryFeedback(args: {
  hint: {
    id: string;
    name: string;
    entityType: string;
    sourceUrl: string | null;
    sourceTitle: string | null;
    confidence: number | null;
    sourceSignalId: string | null;
  };
  finalDecision: DiscoveryFeedbackDecision;
  finalEntityType?: string | null;
  finalPrimarySource?: string | null;
  reasonTags?: DiscoveryFeedbackReasonTag[];
  comment?: string | null;
  operator?: string | null;
}): Promise<void> {
  await appendDiscoveryFeedbackRecord({
    entityName: args.hint.name,
    originalEntityType: args.hint.entityType,
    finalEntityType: args.finalEntityType ?? args.hint.entityType,
    originalDecision: null,
    finalDecision: args.finalDecision,
    originalPrimarySource: args.hint.sourceUrl ?? null,
    finalPrimarySource: args.finalPrimarySource ?? args.hint.sourceUrl ?? null,
    reasonTags: args.reasonTags ?? [],
    comment: args.comment ?? null,
    authenticityScore:
      typeof args.hint.confidence === "number" ? Math.round(args.hint.confidence * 100) : null,
    operator: args.operator ?? "operator",
    context: {
      discoveryItemId: args.hint.sourceSignalId ?? args.hint.id,
      source: "discovery_item",
    },
    evidence: args.hint.sourceUrl
      ? [
          {
            url: args.hint.sourceUrl,
            sourceLevel: "secondary",
            evidenceRole: args.hint.sourceTitle ?? "source_signal",
          },
        ]
      : undefined,
  });
}

export async function submitEntityHintFeedbackAction(
  payload: SubmitEntityHintFeedbackPayload,
): Promise<ActionResult & { feedbackId?: string }> {
  try {
    await requireMuHubAdmin();
    if (!isEntityHintFeedbackAction(payload.action)) {
      return { ok: false, error: `Invalid action: ${payload.action}` };
    }

    const tags = payload.feedbackTags?.length
      ? parseFeedbackTags(payload.feedbackTags)
      : [];

    const hint = await prisma.entityHint.findUnique({
      where: { id: payload.hintId },
      select: {
        id: true,
        name: true,
        entityType: true,
        sourceUrl: true,
        sourceTitle: true,
        confidence: true,
        sourceSignalId: true,
      },
    });
    if (!hint) {
      return { ok: false, error: "Entity Hint not found" };
    }

    const { id } = await submitEntityHintFeedback({
      entityHintId: payload.hintId,
      action: payload.action,
      reviewer: "operator",
      feedbackReason: payload.feedbackReason,
      feedbackTags: tags,
      isHighValue: payload.isHighValue ?? null,
      shouldTrackLongTerm: payload.shouldTrackLongTerm ?? null,
      notes: payload.notes,
    });

    await appendEntityHintDiscoveryFeedback({
      hint,
      finalDecision: mapActionToDiscoveryDecision(payload.action),
      finalEntityType:
        payload.action === "RETYPE"
          ? payload.finalEntityType ?? hint.entityType
          : hint.entityType,
      finalPrimarySource:
        payload.action === "CHANGE_PRIMARY_SOURCE"
          ? payload.finalPrimarySource ?? hint.sourceUrl ?? null
          : hint.sourceUrl ?? null,
      reasonTags: mapReasonTags(tags),
      comment: payload.notes || payload.feedbackReason || null,
      operator: "operator",
    });

    revalidatePath("/admin/discovery/entities");
    revalidatePath(`/admin/discovery/entities/${payload.hintId}`);
    revalidatePath("/admin/discovery/feedback");
    return { ok: true, feedbackId: id };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function updateEntityHintStatusAction(
  hintId: string,
  status: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    await requireMuHubAdmin();
    if (!isEntityHintStatus(status)) {
      return { ok: false, error: `Invalid status: ${status}` };
    }

    const hint = await prisma.entityHint.findUnique({
      where: { id: hintId },
      select: {
        id: true,
        name: true,
        entityType: true,
        sourceUrl: true,
        sourceTitle: true,
        confidence: true,
        sourceSignalId: true,
      },
    });
    if (!hint) {
      return { ok: false, error: "Entity Hint not found" };
    }

    await prisma.entityHint.update({
      where: { id: hintId },
      data: {
        status,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      },
    });

    const finalDecision: DiscoveryFeedbackDecision =
      status === "ACCEPTED" ? "ACCEPT" : status === "REJECTED" ? "REJECT" : "MERGE";

    await appendEntityHintDiscoveryFeedback({
      hint,
      finalDecision,
      comment: reason?.trim() || `Entity status changed to ${status}`,
      operator: "operator",
    });

    revalidatePath("/admin/discovery/entities");
    revalidatePath(`/admin/discovery/entities/${hintId}`);
    revalidatePath("/admin/discovery/feedback");
    return { ok: true };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function extractEntityHintsForSignalAction(signalId: string): Promise<
  | {
      ok: true;
      extracted: number;
      skipped: number;
      duplicate: number;
      skippedReason?: string;
      skippedLowQuality?: number;
      skippedNavigation?: number;
      skippedGeneric?: number;
      textSource?: string;
      textLength?: number;
      errors?: string[];
    }
  | { ok: false; error: string }
> {
  try {
    await requireMuHubAdmin();
    const { extractAndPersistHintsForSignal } = await import(
      "@/lib/discovery/entity/persist-hints"
    );
    const result = await extractAndPersistHintsForSignal(signalId, {
      useAi: true,
      force: true,
    });
    revalidatePath("/admin/discovery/entities");
    revalidatePath(`/admin/discovery/signals/${signalId}`);
    return {
      ok: true,
      extracted: result.extracted,
      skipped: result.skipped,
      duplicate: result.duplicate,
      skippedReason: result.skippedReason,
      skippedLowQuality: result.skippedLowQuality,
      skippedNavigation: result.skippedNavigation,
      skippedGeneric: result.skippedGeneric,
      textSource: result.textSource,
      textLength: result.textLength,
      errors: result.errors,
    };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

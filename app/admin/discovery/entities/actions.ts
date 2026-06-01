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

    await appendDiscoveryFeedbackRecord({
      entityName: hint.name,
      originalEntityType: hint.entityType,
      finalEntityType:
        payload.action === "RETYPE"
          ? payload.finalEntityType ?? hint.entityType
          : hint.entityType,
      originalDecision: null,
      finalDecision: mapActionToDiscoveryDecision(payload.action),
      originalPrimarySource: hint.sourceUrl ?? null,
      finalPrimarySource:
        payload.action === "CHANGE_PRIMARY_SOURCE"
          ? payload.finalPrimarySource ?? hint.sourceUrl ?? null
          : hint.sourceUrl ?? null,
      reasonTags: mapReasonTags(tags),
      comment: payload.notes || payload.feedbackReason || null,
      authenticityScore:
        typeof hint.confidence === "number" ? Math.round(hint.confidence * 100) : null,
      operator: "operator",
      context: {
        discoveryItemId: hint.sourceSignalId ?? hint.id,
        source: "discovery_item",
      },
      evidence: hint.sourceUrl
        ? [
            {
              url: hint.sourceUrl,
              sourceLevel: "secondary",
              evidenceRole: hint.sourceTitle ?? "source_signal",
            },
          ]
        : undefined,
    });

    revalidatePath("/admin/discovery/entities");
    revalidatePath(`/admin/discovery/entities/${payload.hintId}`);
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

    await prisma.entityHint.update({
      where: { id: hintId },
      data: {
        status,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      },
    });

    revalidatePath("/admin/discovery/entities");
    revalidatePath(`/admin/discovery/entities/${hintId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function extractEntityHintsForSignalAction(signalId: string): Promise<
  | { ok: true; extracted: number; skipped: number; duplicate: number }
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
    };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  type DiscoveryFeedbackDecision,
  type DiscoveryFeedbackReasonTag,
} from "@/lib/discovery/feedback-capture";
import { recordEntityHumanDecision } from "@/lib/discovery/entity/human-decision";
import {
  isEntityHintFeedbackAction,
  parseFeedbackTags,
  type EntityHintFeedbackAction,
  type EntityHintFeedbackTag,
} from "@/lib/discovery/entity/feedback-types";
import { isEntityHintStatus } from "@/lib/discovery/entity/types";

type ActionResult = { ok: true } | { ok: false; error: string };

export type SubmitEntityHintFeedbackPayload = {
  hintId: string;
  action: EntityHintFeedbackAction;
  feedbackTags?: EntityHintFeedbackTag[];
  feedbackReason?: string;
  notes?: string;
  finalEntityType?: string;
  finalPrimarySource?: string;
  mergeTarget?: string;
  primarySourceOverride?: {
    url?: string;
    sourceLevel?: string;
    reason?: string;
  };
  expertComment?: string;
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
    "generic_organization",
    "sentence_fragment",
    "article_topic_only",
    "no_primary_source",
    "duplicate",
    "irrelevant",
    "project_to_dataset",
    "project_to_model",
    "organization_to_project",
    "concept_to_tool",
    "type_boundary_corrected",
    "source_should_be_primary",
    "article_is_secondary",
    "found_github",
    "found_huggingface",
    "found_official_site",
    "found_docs",
    "source_cross_verified",
    "same_entity",
    "alias",
    "parent_child_resource",
    "duplicate_source",
    "same_organization",
    "has_primary_source",
    "github_verified",
    "huggingface_verified",
    "official_website",
    "official_docs",
    "multiple_sources",
    "project_like_resource",
    "high_industry_relevance",
    "publishing_ai_relevant",
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

    const result = await recordEntityHumanDecision({
      entityHintId: payload.hintId,
      decision: mapActionToDiscoveryDecision(payload.action),
      reviewer: "operator",
      reasonTags: mapReasonTags(tags),
      comment: payload.notes || payload.feedbackReason || null,
      finalEntityType: payload.finalEntityType ?? null,
      finalPrimarySource: payload.finalPrimarySource ?? null,
      mergeTarget: payload.mergeTarget ?? null,
      primarySourceOverride: payload.primarySourceOverride ?? null,
      expertComment: payload.expertComment ?? payload.notes ?? null,
      operator: "operator",
      isHighValue: payload.isHighValue ?? null,
      shouldTrackLongTerm: payload.shouldTrackLongTerm ?? null,
    });

    revalidatePath("/admin/discovery/entities");
    revalidatePath(`/admin/discovery/entities/${payload.hintId}`);
    revalidatePath("/admin/discovery/feedback");
    return { ok: true, feedbackId: result.feedbackId };
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

    const finalDecision: DiscoveryFeedbackDecision =
      status === "ACCEPTED"
        ? "ACCEPT"
        : status === "REJECTED"
          ? "REJECT"
          : status === "PENDING"
            ? "NEEDS_REVIEW"
            : "MERGE";

    await recordEntityHumanDecision({
      entityHintId: hintId,
      decision: finalDecision,
      finalStatus: status,
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

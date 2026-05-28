"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
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
  isHighValue?: boolean;
  shouldTrackLongTerm?: boolean;
};

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

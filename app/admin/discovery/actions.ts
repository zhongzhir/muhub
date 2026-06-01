"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  approveDiscoveryCandidateImport,
  mergeDiscoveryCandidateToProject,
  rejectDiscoveryCandidate,
} from "@/lib/discovery/import-candidate";
import {
  appendDiscoveryFeedbackRecord,
  type DiscoveryFeedbackDecision,
  type DiscoveryFeedbackReasonTag,
} from "@/lib/discovery/feedback-capture";
import { runDiscoverySourceByKey } from "@/lib/discovery/run-discovery-source";
import { recomputeDiscoveryReviewPriorityBatch } from "@/lib/discovery/persist-review-priority";

export type DiscoveryAdminMutationResult =
  | { ok: true; slug?: string; projectId?: string }
  | { ok: false; error: string };

export type SubmitDiscoveryFeedbackPayload = {
  candidateId?: string;
  entityName: string;
  originalEntityType?: string | null;
  finalEntityType?: string | null;
  originalDecision?: string | null;
  finalDecision: DiscoveryFeedbackDecision;
  originalPrimarySource?: string | null;
  finalPrimarySource?: string | null;
  reasonTags?: DiscoveryFeedbackReasonTag[];
  comment?: string | null;
  authenticityScore?: number | null;
  targetProjectId?: string | null;
  source?: "discovery_candidate" | "discovery_item" | "project_import_review";
};

export async function submitDiscoveryFeedbackAction(
  payload: SubmitDiscoveryFeedbackPayload,
): Promise<{ ok: true; feedbackId: string } | { ok: false; error: string }> {
  try {
    const { userId } = await requireMuHubAdmin();
    const record = await appendDiscoveryFeedbackRecord({
      entityName: payload.entityName,
      originalEntityType: payload.originalEntityType ?? null,
      finalEntityType: payload.finalEntityType ?? payload.originalEntityType ?? null,
      originalDecision: payload.originalDecision ?? null,
      finalDecision: payload.finalDecision,
      originalPrimarySource: payload.originalPrimarySource ?? null,
      finalPrimarySource: payload.finalPrimarySource ?? payload.originalPrimarySource ?? null,
      reasonTags: payload.reasonTags ?? [],
      comment: payload.comment ?? null,
      authenticityScore: payload.authenticityScore ?? null,
      operator: userId,
      context: {
        discoveryCandidateId: payload.candidateId ?? null,
        targetProjectId: payload.targetProjectId ?? null,
        source: payload.source ?? "discovery_candidate",
      },
      evidence: [
        ...(payload.originalPrimarySource
          ? [
              {
                url: payload.originalPrimarySource,
                evidenceRole: "original_primary_source",
              },
            ]
          : []),
        ...(payload.finalPrimarySource && payload.finalPrimarySource !== payload.originalPrimarySource
          ? [
              {
                url: payload.finalPrimarySource,
                evidenceRole: "final_primary_source",
              },
            ]
          : []),
      ],
    });
    revalidatePath("/admin/discovery/feedback");
    if (payload.candidateId) {
      revalidatePath(`/admin/discovery/${payload.candidateId}`);
    }
    return { ok: true, feedbackId: record.id };
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function approveDiscoveryCandidateAction(
  candidateId: string,
): Promise<DiscoveryAdminMutationResult> {
  try {
    const { userId } = await requireMuHubAdmin();
    const r = await approveDiscoveryCandidateImport(candidateId, userId);
    revalidatePath("/admin/discovery");
    revalidatePath(`/admin/discovery/${candidateId}`);
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${r.projectId}/edit`);
    return { ok: true, slug: r.slug, projectId: r.projectId };
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function rejectDiscoveryCandidateAction(
  candidateId: string,
  note?: string | null,
): Promise<DiscoveryAdminMutationResult> {
  try {
    const { userId } = await requireMuHubAdmin();
    await rejectDiscoveryCandidate(candidateId, userId, note);
    revalidatePath("/admin/discovery");
    revalidatePath(`/admin/discovery/${candidateId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function mergeDiscoveryCandidateAction(
  candidateId: string,
  projectId: string,
): Promise<DiscoveryAdminMutationResult> {
  try {
    const { userId } = await requireMuHubAdmin();
    const pid = projectId.trim();
    await mergeDiscoveryCandidateToProject(candidateId, pid, userId);
    revalidatePath("/admin/discovery");
    revalidatePath(`/admin/discovery/${candidateId}`);
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${pid}/edit`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type RunDiscoveryResult =
  | ({ ok: true } & Awaited<ReturnType<typeof runDiscoverySourceByKey>>)
  | { ok: false; error: string };

export async function runDiscoverySourceAction(sourceKey: string): Promise<RunDiscoveryResult> {
  try {
    await requireMuHubAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
  const key = sourceKey.trim();
  if (!key) {
    return { ok: false, error: "缺少 sourceKey" };
  }
  const result = await runDiscoverySourceByKey(key);
  revalidatePath("/admin/discovery");
  revalidatePath("/admin/discovery/sources");
  if (!result.ok) {
    return { ok: false, error: result.error ?? "运行失败" };
  }
  const { ok, ...rest } = result;
  void ok;
  return { ok: true as const, ...rest };
}

export async function recomputeReviewPriorityBatchAction(
  limit?: number,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  try {
    await requireMuHubAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
  const lim = typeof limit === "number" && Number.isFinite(limit) ? limit : 280;
  const { updated } = await recomputeDiscoveryReviewPriorityBatch(lim);
  revalidatePath("/admin/discovery");
  return { ok: true, updated };
}

"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  convertDiscoverySignalToCandidate,
  updateDiscoverySignalStatus,
} from "@/lib/discovery/signals";

type ActionResult = { ok: true; candidateId?: string } | { ok: false; error: string };

export async function convertDiscoverySignalAction(signalId: string): Promise<ActionResult> {
  try {
    await requireMuHubAdmin();
    const result = await convertDiscoverySignalToCandidate(signalId);
    revalidatePath("/admin/discovery/signals");
    revalidatePath(`/admin/discovery/signals/${signalId}`);
    revalidatePath("/admin/discovery");
    revalidatePath(`/admin/discovery/${result.candidateId}`);
    return { ok: true, candidateId: result.candidateId };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function rejectDiscoverySignalAction(
  signalId: string,
  reviewNote?: string,
): Promise<ActionResult> {
  try {
    await requireMuHubAdmin();
    await updateDiscoverySignalStatus(signalId, "REJECTED", reviewNote);
    revalidatePath("/admin/discovery/signals");
    revalidatePath(`/admin/discovery/signals/${signalId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function markDiscoverySignalReviewedAction(
  signalId: string,
  reviewNote?: string,
): Promise<ActionResult> {
  try {
    await requireMuHubAdmin();
    await updateDiscoverySignalStatus(signalId, "REVIEWED", reviewNote);
    revalidatePath("/admin/discovery/signals");
    revalidatePath(`/admin/discovery/signals/${signalId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

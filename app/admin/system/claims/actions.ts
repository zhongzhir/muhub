"use server";

import { revalidatePath } from "next/cache";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const CLAIM_STATUSES = new Set(["PENDING", "REVIEWING", "APPROVED", "REJECTED"]);

export async function updateProjectClaimStatus(formData: FormData) {
  try {
    await requireMuHubAdmin();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      throw new Error(error.message);
    }
    throw error;
  }

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim().toUpperCase();
  if (!id || !CLAIM_STATUSES.has(status)) {
    throw new Error("无效的认领申请状态。");
  }

  await prisma.projectClaim.update({
    where: { id },
    data: {
      status,
      reviewedAt: status === "APPROVED" || status === "REJECTED" ? new Date() : null,
    },
  });
  revalidatePath("/admin/system/claims");
}

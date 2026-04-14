"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  markDiscoveredCandidateDiscarded,
  markDiscoveredCandidateImported,
} from "@/lib/discovery-candidates";

async function assertAuthenticated(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("请先登录");
  }
}

export async function discardDiscoveryCandidateAction(id: string): Promise<void> {
  await assertAuthenticated();
  await markDiscoveredCandidateDiscarded(id);
  revalidatePath("/admin/discovery/items");
}

export async function markDiscoveryImportedAction(id: string): Promise<void> {
  await assertAuthenticated();
  await markDiscoveredCandidateImported(id);
  revalidatePath("/admin/discovery/items");
}

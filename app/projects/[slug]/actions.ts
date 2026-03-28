"use server";

import { revalidatePath } from "next/cache";
import { syncGithubSnapshotForProjectSlug } from "@/lib/github-sync";

export type RefreshGithubSnapshotState = {
  ok: boolean;
  error?: string;
  redirectPath?: string;
};

export async function refreshProjectGithubSnapshot(
  _prev: RefreshGithubSnapshotState,
  formData: FormData,
): Promise<RefreshGithubSnapshotState> {
  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) {
    return { ok: false, error: "缺少项目标识，无法刷新。" };
  }

  const result = await syncGithubSnapshotForProjectSlug(slug);
  if (!result.ok) {
    return { ok: false, error: result.message };
  }

  revalidatePath(`/projects/${slug}`, "page");
  revalidatePath(`/dashboard/projects/${slug}`, "page");

  return {
    ok: true,
    redirectPath: `/dashboard/projects/${encodeURIComponent(slug)}`,
  };
}

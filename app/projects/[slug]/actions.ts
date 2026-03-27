"use server";

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

  return { ok: true, redirectPath: `/projects/${slug}` };
}

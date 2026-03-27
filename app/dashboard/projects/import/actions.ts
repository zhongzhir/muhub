"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  buildNewProjectSearchParams,
  fetchGitHubRepoForImport,
  parseGitHubRepoUrl,
} from "@/lib/github";

export type ImportGitHubFormState = {
  ok: boolean;
  formError?: string;
};

const initialFail: ImportGitHubFormState = { ok: false };

export async function importGitHubRepo(
  _prev: ImportGitHubFormState,
  formData: FormData,
): Promise<ImportGitHubFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ...initialFail, formError: "请先登录后再导入仓库。" };
  }

  const repoUrl = String(formData.get("repoUrl") ?? "").trim();

  if (!repoUrl) {
    return { ...initialFail, formError: "请填写 GitHub 仓库地址。" };
  }

  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    return { ...initialFail, formError: "GitHub 地址格式错误" };
  }

  const result = await fetchGitHubRepoForImport(parsed.owner, parsed.repo);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return { ...initialFail, formError: "未找到该 GitHub 仓库" };
    }
    return { ...initialFail, formError: "GitHub 请求失败，请稍后再试" };
  }

  const qs = buildNewProjectSearchParams(result.data);
  qs.set("creationSource", "import");
  redirect(`/dashboard/projects/new?${qs.toString()}`);
}

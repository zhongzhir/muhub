"use server";

import { auth } from "@/auth";
import {
  buildNewProjectSearchParams,
  fetchGitHubRepoForImport,
  parseGitHubRepoUrl,
} from "@/lib/github";
import { parseProjectSourceUrl } from "@/lib/project-source-url";

export type ImportGitHubFormState = {
  ok: boolean;
  formError?: string;
  redirectPath?: string;
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

  const source = parseProjectSourceUrl(repoUrl);
  if (source?.type === "GITCC") {
    const segments = new URL(source.url).pathname.split("/").filter(Boolean);
    const name = segments.at(-1)?.replace(/\.git$/i, "") || "GitCC Project";
    const qs = new URLSearchParams();
    qs.set("name", name);
    qs.set("creationSource", "import");
    qs.set("extraSourcesJson", JSON.stringify([{ kind: "OTHER", url: source.url, label: "GitCC" }]));
    return { ok: true, redirectPath: `/dashboard/projects/new?${qs.toString()}` };
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
  return { ok: true, redirectPath: `/dashboard/projects/new?${qs.toString()}` };
}

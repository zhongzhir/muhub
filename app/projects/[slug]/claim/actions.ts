"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { githubRepoUrlsMatch } from "@/lib/github";
import { parseRepoUrl } from "@/lib/repo-platform";
import { prisma } from "@/lib/prisma";
import { normalizeProjectSlugParam } from "@/lib/route-slug";

export type ClaimProjectFormState = {
  ok: boolean;
  formError?: string;
  redirectPath?: string;
};

const initialFail: ClaimProjectFormState = { ok: false };

export async function claimProject(
  _prev: ClaimProjectFormState,
  formData: FormData,
): Promise<ClaimProjectFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ...initialFail, formError: "请先登录后再认领项目。" };
  }
  const claimerId = session.user.id;

  if (!process.env.DATABASE_URL?.trim()) {
    return { ...initialFail, formError: "未配置 DATABASE_URL，无法完成认领。" };
  }

  const slug = normalizeProjectSlugParam(String(formData.get("slug") ?? ""));
  const repoUrl = String(formData.get("repoUrl") ?? "").trim();

  if (!slug) {
    return { ...initialFail, formError: "缺少项目标识。" };
  }

  if (!repoUrl) {
    return { ...initialFail, formError: "请填写代码仓库地址（GitHub / Gitee）。" };
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      githubUrl: true,
      claimStatus: true,
    },
  });

  if (!project) {
    return { ...initialFail, formError: "项目不存在。" };
  }

  if (project.claimStatus === "CLAIMED") {
    return { ...initialFail, formError: "该项目已被认领" };
  }

  if (!project.githubUrl?.trim()) {
    return { ...initialFail, formError: "该项目未绑定代码仓库，无法通过仓库地址认领。" };
  }

  if (!parseRepoUrl(repoUrl)) {
    return { ...initialFail, formError: "仓库地址格式错误（当前支持 GitHub、Gitee）" };
  }

  if (!githubRepoUrlsMatch(project.githubUrl, repoUrl)) {
    return { ...initialFail, formError: "仓库地址与项目不匹配" };
  }

  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) {
    return { ...initialFail, formError: "仓库地址格式错误（当前支持 GitHub、Gitee）" };
  }

  const claimedBy = `${parsed.owner}/${parsed.repo}`;

  const updated = await prisma.project.updateMany({
    where: { id: project.id, claimStatus: "UNCLAIMED" },
    data: {
      claimStatus: "CLAIMED",
      claimedAt: new Date(),
      claimedBy,
      claimedByUserId: claimerId,
    },
  });

  if (updated.count === 0) {
    return { ...initialFail, formError: "该项目已被认领" };
  }

  revalidatePath(`/projects/${slug}`, "page");

  return { ok: true, redirectPath: `/projects/${slug}` };
}

"use server";

import { redirect } from "next/navigation";
import { parseGitHubRepoUrl, githubRepoUrlsMatch } from "@/lib/github";
import { prisma } from "@/lib/prisma";

export type ClaimProjectFormState = {
  ok: boolean;
  formError?: string;
};

const initialFail: ClaimProjectFormState = { ok: false };

export async function claimProject(
  _prev: ClaimProjectFormState,
  formData: FormData,
): Promise<ClaimProjectFormState> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ...initialFail, formError: "未配置 DATABASE_URL，无法完成认领。" };
  }

  const slug = String(formData.get("slug") ?? "").trim();
  const repoUrl = String(formData.get("repoUrl") ?? "").trim();

  if (!slug) {
    return { ...initialFail, formError: "缺少项目标识。" };
  }

  if (!repoUrl) {
    return { ...initialFail, formError: "请填写 GitHub 仓库地址。" };
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
    return { ...initialFail, formError: "该项目未绑定 GitHub 仓库，无法通过仓库地址认领。" };
  }

  if (!parseGitHubRepoUrl(repoUrl)) {
    return { ...initialFail, formError: "GitHub 地址格式错误" };
  }

  if (!githubRepoUrlsMatch(project.githubUrl, repoUrl)) {
    return { ...initialFail, formError: "GitHub 地址与项目不匹配" };
  }

  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    return { ...initialFail, formError: "GitHub 地址格式错误" };
  }

  const claimedBy = `${parsed.owner}/${parsed.repo}`;

  const updated = await prisma.project.updateMany({
    where: { id: project.id, claimStatus: "UNCLAIMED" },
    data: {
      claimStatus: "CLAIMED",
      claimedAt: new Date(),
      claimedBy,
    },
  });

  if (updated.count === 0) {
    return { ...initialFail, formError: "该项目已被认领" };
  }

  redirect(`/projects/${slug}`);
}

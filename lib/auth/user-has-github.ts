import { prisma } from "@/lib/prisma";

/** 是否已关联 GitHub OAuth（用于认领 GitHub 仓库等项目） */
export async function userHasGitHubAccount(userId: string): Promise<boolean> {
  const row = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { id: true },
  });
  return Boolean(row);
}

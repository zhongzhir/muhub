import { scheduleAiSummaryForUpdate } from "@/lib/ai/update-summary-ai";
import { prisma } from "@/lib/prisma";

export type CreateReleaseUpdateArgs = {
  projectId: string;
  platform: "github" | "gitee";
  owner: string;
  repo: string;
  tag: string;
  releaseAt: Date;
};

/** 新建一条 Release 类仓库动态，并异步触发 AI 摘要（无 key 时仅保留原文） */
export async function createReleaseProjectUpdate(args: CreateReleaseUpdateArgs): Promise<void> {
  const releaseUrl =
    args.platform === "github"
      ? `https://github.com/${args.owner}/${args.repo}/releases/tag/${encodeURIComponent(args.tag)}`
      : `https://gitee.com/${args.owner}/${args.repo}/releases/${encodeURIComponent(args.tag)}`;

  const created = await prisma.projectUpdate.create({
    data: {
      projectId: args.projectId,
      sourceType: "GITHUB",
      sourceLabel: "Release",
      title: `${args.tag} 发布`,
      content: `仓库发布新版本 ${args.tag}，可在 Release 页查看详情与变更说明。`,
      sourceUrl: releaseUrl,
      occurredAt: args.releaseAt,
    },
  });
  scheduleAiSummaryForUpdate(created.id);
}

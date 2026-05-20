import { validateProjectForPublish, type ParsedAdminProjectInput } from "@/lib/admin-project-edit";
import { writeProjectActionLog } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";

export type PublishProjectResult = {
  ok: boolean;
  error?: string;
  blockingErrors?: string[];
};

/**
 * 自动上架发布：与后台手动发布一致，不依赖 session / server action。
 */
export async function publishProjectAfterAiEnrichment(projectId: string): Promise<PublishProjectResult> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      simpleSummary: true,
      primaryCategory: true,
      tags: true,
      websiteUrl: true,
      githubUrl: true,
      aiCardSummary: true,
      publishedAt: true,
      externalLinks: {
        select: { platform: true, url: true, label: true, isPrimary: true },
      },
      sources: {
        select: { kind: true, url: true },
      },
    },
  });
  if (!row) {
    return { ok: false, error: "项目不存在或已删除" };
  }

  const parsed: ParsedAdminProjectInput = {
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    simpleSummary: row.simpleSummary,
    primaryCategory: row.primaryCategory,
    tags: row.tags,
    websiteUrl: row.websiteUrl,
    githubUrl: row.githubUrl,
    aiCardSummary: row.aiCardSummary,
    externalLinks: row.externalLinks.map((link) => ({
      platform: link.platform,
      url: link.url,
      label: link.label,
      isPrimary: link.isPrimary,
    })),
  };

  const validation = validateProjectForPublish(
    parsed,
    row.sources.map((source) => ({ kind: source.kind, url: source.url })),
  );
  if (!validation.ok) {
    return {
      ok: false,
      error: validation.blockingErrors.join("；"),
      blockingErrors: validation.blockingErrors,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: row.id },
      data: {
        status: "PUBLISHED",
        visibilityStatus: "PUBLISHED",
        isPublic: true,
        publishedAt: row.publishedAt ?? new Date(),
      },
    });
    await writeProjectActionLog(
      {
        projectId: row.id,
        action: "publish",
        detail: "chinese-independent-developer 自动上架发布",
      },
      tx,
    );
  });

  return { ok: true };
}

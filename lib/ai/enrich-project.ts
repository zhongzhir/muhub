import { generateProjectDescription, generateProjectTags, isAiConfigured } from "@/lib/ai/project-ai";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

function eligibleSourceForDescription(sourceType: string | null | undefined): boolean {
  const s = (sourceType ?? "").toLowerCase();
  return s === "import" || s === "seed";
}

function eligibleSourceForTags(sourceType: string | null | undefined): boolean {
  return (sourceType ?? "").toLowerCase() === "import";
}

/**
 * 导入 / 种子项目在简介为空时补全 description；仅导入项目在标签为空时补全 tags。
 * 未配置 AI 或无数据库时立即返回。
 */
export async function enrichProjectWithAi(slug: string): Promise<void> {
  if (!process.env.DATABASE_URL?.trim() || !isAiConfigured()) {
    return;
  }

  const project = await prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: {
      id: true,
      name: true,
      tagline: true,
      description: true,
      githubUrl: true,
      sourceType: true,
      tags: true,
    },
  });
  if (!project) {
    return;
  }

  const needDesc =
    eligibleSourceForDescription(project.sourceType) &&
    (!project.description || !project.description.trim());

  const needTags =
    eligibleSourceForTags(project.sourceType) &&
    project.githubUrl?.trim() &&
    (!project.tags || project.tags.length === 0);

  if (!needDesc && !needTags) {
    return;
  }

  const patch: { description?: string; tags?: string[] } = {};

  if (needDesc) {
    const desc = await generateProjectDescription({
      name: project.name,
      tagline: project.tagline,
      githubUrl: project.githubUrl,
    });
    if (desc?.trim()) {
      patch.description = desc.trim();
    }
  }

  if (needTags) {
    const tags = await generateProjectTags({
      name: project.name,
      tagline: project.tagline,
      githubUrl: project.githubUrl,
    });
    if (tags && tags.length > 0) {
      patch.tags = tags;
    }
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  try {
    await prisma.project.update({
      where: { id: project.id },
      data: patch,
    });
  } catch (e) {
    console.error("[enrichProjectWithAi]", e);
  }
}

/** 创建/导入后不阻塞 redirect */
export function scheduleProjectAiEnrichment(slug: string): void {
  void enrichProjectWithAi(slug).catch((e) => console.error("[scheduleProjectAiEnrichment]", e));
}

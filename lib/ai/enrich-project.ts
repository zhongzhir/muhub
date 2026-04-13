import { generateProjectDescription, generateProjectTags, isAiConfigured } from "@/lib/ai/project-ai";
import { updateDiscoveryAiStatus } from "@/agents/discovery/discovery-store";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

type AiEnrichmentStatus = "scheduled" | "done" | "failed";

type AiProjectContext = {
  id: string;
  sourceType: string | null;
  discoverySourceId: string | null;
};

function eligibleSourceForDescription(sourceType: string | null | undefined): boolean {
  const s = (sourceType ?? "").toLowerCase();
  return s === "import" || s === "seed" || s === "discovery-json-queue";
}

function eligibleSourceForTags(sourceType: string | null | undefined): boolean {
  const s = (sourceType ?? "").toLowerCase();
  return s === "import" || s === "discovery-json-queue";
}

function normalizeAiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return String(error).slice(0, 500);
}

async function updateProjectAiStatus(
  projectId: string,
  status: AiEnrichmentStatus,
  errorMessage: string | null,
): Promise<void> {
  try {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiStatus: status,
        aiUpdatedAt: new Date(),
        aiError: errorMessage,
      },
    });
  } catch (e) {
    console.error("[updateProjectAiStatus]", e);
  }
}

async function updateDiscoveryStatusIfNeeded(
  project: { sourceType: string | null; discoverySourceId: string | null },
  status: "scheduled" | "done" | "failed",
): Promise<void> {
  if (project.sourceType !== "discovery-json-queue" || !project.discoverySourceId?.trim()) {
    return;
  }
  try {
    await updateDiscoveryAiStatus(project.discoverySourceId, status);
  } catch (e) {
    console.error("[updateDiscoveryStatusIfNeeded]", e);
  }
}

async function getAiProjectContext(slug: string): Promise<AiProjectContext | null> {
  return prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: {
      id: true,
      sourceType: true,
      discoverySourceId: true,
    },
  });
}

/**
 * 导入 / 种子 / JSON Discovery 队列导入项目在简介为空时补全 description；
 * 导入类项目在标签为空且具备 GitHub 等信息时补全 tags。
 * 未配置 AI 或无数据库时立即返回。
 */
export async function enrichProjectWithAi(slug: string): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }
  if (!isAiConfigured()) {
    const project = await getAiProjectContext(slug);
    if (project) {
      await updateProjectAiStatus(project.id, "failed", "AI provider not configured");
      await updateDiscoveryStatusIfNeeded(project, "failed");
    }
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
      discoverySourceId: true,
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
    await updateProjectAiStatus(project.id, "done", null);
    await updateDiscoveryStatusIfNeeded(project, "done");
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

  try {
    if (Object.keys(patch).length > 0) {
      await prisma.project.update({
        where: { id: project.id },
        data: patch,
      });
    }
    await updateProjectAiStatus(project.id, "done", null);
    await updateDiscoveryStatusIfNeeded(project, "done");
  } catch (e) {
    const message = normalizeAiError(e);
    await updateProjectAiStatus(project.id, "failed", message);
    await updateDiscoveryStatusIfNeeded(project, "failed");
    console.error("[enrichProjectWithAi]", e);
  }
}

/** 创建/导入后不阻塞 redirect */
export function scheduleProjectAiEnrichment(slug: string): void {
  void (async () => {
    const project = await getAiProjectContext(slug);
    if (project) {
      await updateProjectAiStatus(project.id, "scheduled", null);
      await updateDiscoveryStatusIfNeeded(project, "scheduled");
    }
    await enrichProjectWithAi(slug);
  })().catch(async (e) => {
    const project = await getAiProjectContext(slug);
    if (project) {
      await updateProjectAiStatus(project.id, "failed", normalizeAiError(e));
      await updateDiscoveryStatusIfNeeded(project, "failed");
    }
    console.error("[scheduleProjectAiEnrichment]", e);
  });
}

import { enrichProjectWithAi } from "@/lib/ai/enrich-project";
import { isAiConfigured } from "@/lib/ai/project-ai";
import {
  buildProjectContentSourceSnapshot,
  generateProjectAIContent,
  saveProjectAIContent,
  type ProjectAIContent,
} from "@/lib/project-ai-content";
import {
  buildProjectInsightSourceSnapshot,
  computeProjectCompleteness,
  computeProjectSourceLevel,
  generateProjectAIInsight,
  saveProjectAIInsight,
  type ProjectAIInsight,
  type ProjectAISignals,
} from "@/lib/project-ai-insight";
import { normalizeChineseExpression, normalizeChineseList } from "@/lib/zh-normalization";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type PostImportProjectAiResult = {
  success: boolean;
  aiInsightStatus: "success" | "failed" | "skipped";
  aiContentStatus: "success" | "failed" | "skipped";
  error?: string;
  insightError?: string;
  contentError?: string;
};

function normalizeAiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 300);
  }
  return String(error).slice(0, 300);
}

function aiNotConfiguredMessage(): string {
  return "AI 服务未配置，请检查服务器环境变量";
}

function buildDescriptionFromInsight(insight: ProjectAIInsight): string | null {
  const blocks: string[] = [];
  if (insight.whatItIs?.trim()) {
    blocks.push(normalizeChineseExpression(insight.whatItIs.trim()));
  }
  if ((insight.whoFor ?? []).length > 0) {
    blocks.push(`适合：${normalizeChineseList(insight.whoFor).slice(0, 5).join("、")}。`);
  }
  if ((insight.useCases ?? []).length > 0) {
    blocks.push(`典型使用场景：${normalizeChineseList(insight.useCases).slice(0, 5).join("；")}。`);
  }
  if (blocks.length > 0) {
    return blocks.join("\n\n");
  }
  return insight.summary?.trim() ? normalizeChineseExpression(insight.summary.trim()) : null;
}

function buildLongDescriptionFromContent(
  insight: ProjectAIInsight,
  content: ProjectAIContent | null,
): string | null {
  const medium = content?.copy?.medium?.trim();
  if (medium) {
    return normalizeChineseExpression(medium).slice(0, 3000);
  }
  const long = content?.copy?.long?.trim();
  if (long) {
    return normalizeChineseExpression(long).slice(0, 3000);
  }
  const blocks: string[] = [];
  if (insight.summary?.trim()) {
    blocks.push(normalizeChineseExpression(insight.summary.trim()));
  }
  if (insight.whatItIs?.trim()) {
    blocks.push(normalizeChineseExpression(insight.whatItIs.trim()));
  }
  if ((insight.useCases ?? []).length > 0) {
    blocks.push(`典型使用场景：${normalizeChineseList(insight.useCases).slice(0, 6).join("；")}。`);
  }
  return blocks.length ? blocks.join("\n\n").slice(0, 3000) : null;
}

async function loadEnrichmentSnapshot(projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      tagline: true,
      description: true,
      simpleSummary: true,
      primaryCategory: true,
      tags: true,
      aiInsightStatus: true,
      aiContentStatus: true,
    },
  });
}

function validateRequiredEnrichmentFields(
  row: Awaited<ReturnType<typeof loadEnrichmentSnapshot>>,
): string | null {
  if (!row) {
    return "项目不存在或已删除";
  }
  if (row.aiInsightStatus !== "success") {
    return "AI 认知卡未成功生成";
  }
  if (row.aiContentStatus !== "success") {
    return "AI 增强版内容未成功生成";
  }
  if (!row.tagline?.trim()) {
    return "缺少一句话简介";
  }
  if (!row.description?.trim()) {
    return "缺少项目简介";
  }
  if (!row.simpleSummary?.trim()) {
    return "缺少详细介绍";
  }
  if (!row.primaryCategory?.trim()) {
    return "缺少分类";
  }
  if (!row.tags?.length) {
    return "缺少标签";
  }
  return null;
}

/**
 * 导入后完整 AI enrichment：简介、分类、标签、详细介绍、认知卡、增强版内容。
 * 全部成功时 success=true；任一步失败则 success=false（不抛出，便于批次继续）。
 */
export async function generatePostImportProjectAi(
  projectId: string,
): Promise<PostImportProjectAiResult> {
  const base: PostImportProjectAiResult = {
    success: false,
    aiInsightStatus: "skipped",
    aiContentStatus: "skipped",
  };

  if (!process.env.DATABASE_URL?.trim()) {
    return { ...base, error: "未配置 DATABASE_URL" };
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!project) {
    return { ...base, error: "项目不存在或已删除" };
  }

  if (!isAiConfigured()) {
    const message = aiNotConfiguredMessage();
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiStatus: "failed",
        aiError: message,
        aiInsightStatus: "failed",
        aiInsightError: message,
        aiContentStatus: "failed",
        aiContentError: message,
      },
    });
    return {
      ...base,
      aiInsightStatus: "failed",
      aiContentStatus: "failed",
      error: message,
      insightError: message,
      contentError: message,
    };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      aiStatus: "scheduled",
      aiError: null,
      aiInsightStatus: "pending",
      aiInsightError: null,
      aiContentStatus: "pending",
      aiContentError: null,
    },
  });

  try {
    await enrichProjectWithAi(project.slug);
  } catch (error) {
    const message = normalizeAiError(error);
    await prisma.project.update({
      where: { id: projectId },
      data: { aiStatus: "failed", aiError: message },
    });
    console.error("[post-import-project-ai] base enrichment failed", { projectId, error });
  }

  let generatedInsight: Awaited<ReturnType<typeof generateProjectAIInsight>> | null = null;

  try {
    const snapshot = await buildProjectInsightSourceSnapshot(projectId);
    if (!snapshot) {
      throw new Error("项目不存在或已删除");
    }
    const completeness = computeProjectCompleteness(snapshot);
    const sourceLevel = computeProjectSourceLevel(snapshot);
    generatedInsight = await generateProjectAIInsight(snapshot, completeness);
    const signals: ProjectAISignals = {
      github: {
        ...snapshot.github.facts,
        isActive: snapshot.github.facts?.isActive,
        hasReleases: snapshot.github.facts?.hasReleases,
        readmeLength: snapshot.github.facts?.readmeLength,
      },
      website: snapshot.website.facts,
      socials: snapshot.socials.accounts,
      docs: {
        hasDocs: snapshot.website.hasDocs,
        hasDemo: snapshot.website.hasDemo,
        hasPricing: snapshot.website.hasPricing,
        hasContact: snapshot.website.hasContact,
      },
      media: {
        mentions: snapshot.base.recentActivities
          .slice(0, 6)
          .map((item) => item.title)
          .filter(Boolean),
      },
    };
    await saveProjectAIInsight(projectId, {
      insight: generatedInsight.insight,
      completeness,
      signals,
      suggestedTags: generatedInsight.suggestedTags,
      suggestedCategories: generatedInsight.suggestedCategories,
      sourceSnapshot: snapshot,
      sourceLevel,
    });

    const insight = generatedInsight.insight;
    const tagline = insight.summary?.trim()
      ? normalizeChineseExpression(insight.summary.trim()).slice(0, 200)
      : null;
    const description = buildDescriptionFromInsight(insight);
    const categories = [
      generatedInsight.suggestedCategories.primary,
      generatedInsight.suggestedCategories.secondary,
      ...(generatedInsight.suggestedCategories.optional ?? []),
    ].filter((item): item is string => Boolean(item?.trim()));
    const categoryPatch: Prisma.ProjectUpdateInput = {
      ...(tagline ? { tagline } : {}),
      ...(description ? { description } : {}),
      ...(generatedInsight.suggestedTags.length ? { tags: generatedInsight.suggestedTags } : {}),
      ...(generatedInsight.suggestedCategories.primary
        ? { primaryCategory: generatedInsight.suggestedCategories.primary }
        : {}),
      ...(categories.length
        ? { categoriesJson: categories as unknown as Prisma.InputJsonValue }
        : {}),
    };
    if (Object.keys(categoryPatch).length > 0) {
      await prisma.project.update({
        where: { id: projectId },
        data: categoryPatch,
      });
    }
    base.aiInsightStatus = "success";
  } catch (error) {
    const message = normalizeAiError(error);
    base.aiInsightStatus = "failed";
    base.insightError = message;
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiInsightStatus: "failed",
        aiInsightError: message,
      },
    });
    console.error("[post-import-project-ai] insight failed", { projectId, error });
  }

  let generatedContent: ProjectAIContent | null = null;

  try {
    const contentSnapshot = await buildProjectContentSourceSnapshot(projectId);
    if (!contentSnapshot) {
      throw new Error("项目不存在或已删除");
    }
    generatedContent = await generateProjectAIContent(contentSnapshot, { mode: "balanced" });
    await saveProjectAIContent(projectId, { content: generatedContent });

    const insight = generatedInsight?.insight;
    const simpleSummary =
      insight && generatedContent
        ? buildLongDescriptionFromContent(insight, generatedContent)
        : generatedContent?.copy?.medium?.trim() ?? null;
    if (simpleSummary) {
      await prisma.project.update({
        where: { id: projectId },
        data: { simpleSummary },
      });
    }
    base.aiContentStatus = "success";
  } catch (error) {
    const message = normalizeAiError(error);
    base.aiContentStatus = "failed";
    base.contentError = message;
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiContentStatus: "failed",
        aiContentError: message,
      },
    });
    console.error("[post-import-project-ai] content failed", { projectId, error });
  }

  if (base.aiInsightStatus === "success" && base.aiContentStatus === "success") {
    await prisma.project.update({
      where: { id: projectId },
      data: { aiStatus: "done", aiError: null },
    });
  }

  const validationError = validateRequiredEnrichmentFields(await loadEnrichmentSnapshot(projectId));
  if (validationError) {
    base.success = false;
    base.error = validationError;
    return base;
  }

  return {
    ...base,
    success: true,
  };
}

import { isAiConfigured } from "@/lib/ai/project-ai";
import {
  buildProjectContentSourceSnapshot,
  generateProjectAIContent,
  saveProjectAIContent,
} from "@/lib/project-ai-content";
import {
  buildProjectInsightSourceSnapshot,
  computeProjectCompleteness,
  computeProjectSourceLevel,
  generateProjectAIInsight,
  saveProjectAIInsight,
  type ProjectAISignals,
} from "@/lib/project-ai-insight";
import { prisma } from "@/lib/prisma";

export type PostImportProjectAiResult = {
  insight: "success" | "failed" | "skipped";
  content: "success" | "failed" | "skipped";
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

/**
 * 导入后自动生成 AI 认知卡与 AI 增强版传播草稿；失败不阻断导入，仅记录状态。
 */
export async function generatePostImportProjectAi(
  projectId: string,
): Promise<PostImportProjectAiResult> {
  const result: PostImportProjectAiResult = {
    insight: "skipped",
    content: "skipped",
  };

  if (!process.env.DATABASE_URL?.trim()) {
    return result;
  }

  if (!isAiConfigured()) {
    const message = aiNotConfiguredMessage();
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiInsightStatus: "failed",
        aiInsightError: message,
        aiContentStatus: "failed",
        aiContentError: message,
      },
    });
    return {
      insight: "failed",
      content: "failed",
      insightError: message,
      contentError: message,
    };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      aiInsightStatus: "pending",
      aiInsightError: null,
      aiContentStatus: "pending",
      aiContentError: null,
    },
  });

  try {
    const snapshot = await buildProjectInsightSourceSnapshot(projectId);
    if (!snapshot) {
      throw new Error("项目不存在或已删除");
    }
    const completeness = computeProjectCompleteness(snapshot);
    const sourceLevel = computeProjectSourceLevel(snapshot);
    const generated = await generateProjectAIInsight(snapshot, completeness);
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
      insight: generated.insight,
      completeness,
      signals,
      suggestedTags: generated.suggestedTags,
      suggestedCategories: generated.suggestedCategories,
      sourceSnapshot: snapshot,
      sourceLevel,
    });
    result.insight = "success";
  } catch (error) {
    const message = normalizeAiError(error);
    result.insight = "failed";
    result.insightError = message;
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiInsightStatus: "failed",
        aiInsightError: message,
      },
    });
    console.error("[post-import-project-ai] insight failed", { projectId, error });
  }

  try {
    const contentSnapshot = await buildProjectContentSourceSnapshot(projectId);
    if (!contentSnapshot) {
      throw new Error("项目不存在或已删除");
    }
    const content = await generateProjectAIContent(contentSnapshot, { mode: "balanced" });
    await saveProjectAIContent(projectId, { content });
    result.content = "success";
  } catch (error) {
    const message = normalizeAiError(error);
    result.content = "failed";
    result.contentError = message;
    await prisma.project.update({
      where: { id: projectId },
      data: {
        aiContentStatus: "failed",
        aiContentError: message,
      },
    });
    console.error("[post-import-project-ai] content failed", { projectId, error });
  }

  return result;
}

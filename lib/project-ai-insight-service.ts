import { generatePublishingAnalysis } from "@/lib/ai/project-ai";
import {
  buildProjectInsightSourceSnapshot,
  computeProjectCompleteness,
  computeProjectSourceLevel,
  generateProjectAIInsight,
  saveProjectAIInsight,
  type ProjectAIInsight,
  type ProjectAISignals,
  type ProjectAISuggestedCategories,
  type ProjectAISourceLevel,
} from "@/lib/project-ai-insight";
import { prisma } from "@/lib/prisma";
import { syncProjectPublishQualityFields } from "@/lib/project-publishing";

export type GenerateAndSaveProjectAiInsightResult = {
  projectId: string;
  status: "success";
  insight: ProjectAIInsight;
  completeness: ReturnType<typeof computeProjectCompleteness>;
  signals: ProjectAISignals;
  suggestedTags: string[];
  suggestedCategories: ProjectAISuggestedCategories;
  sourceSnapshot: NonNullable<Awaited<ReturnType<typeof buildProjectInsightSourceSnapshot>>>;
  sourceLevel: ProjectAISourceLevel;
  updatedAt: Date;
};

function normalizeAiInsightError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "AI 认知卡生成失败，请稍后重试。";
  return raw === "Missing DEEPSEEK_API_KEY" || raw === "Missing AI_API_KEY"
    ? "AI 服务未配置，请检查服务器环境变量"
    : raw;
}

export async function generateAndSaveProjectAiInsight(
  projectId: string,
  options?: { reason?: string },
): Promise<GenerateAndSaveProjectAiInsightResult> {
  const existing = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("项目不存在或已删除");
  }

  await prisma.project.update({
    where: { id: existing.id },
    data: {
      aiInsightStatus: "pending",
      aiInsightError: null,
      aiError: null,
    },
  });

  try {
    const snapshot = await buildProjectInsightSourceSnapshot(existing.id);
    if (!snapshot) {
      throw new Error("项目不存在或已删除");
    }

    const completeness = computeProjectCompleteness(snapshot);
    const sourceLevel = computeProjectSourceLevel(snapshot);
    const [generated, publishingResult] = await Promise.all([
      generateProjectAIInsight(snapshot, completeness),
      generatePublishingAnalysis({
        name: snapshot.base.name,
        tagline: snapshot.base.tagline,
        description: snapshot.base.description,
        tags: snapshot.base.tags,
        primaryCategory: snapshot.base.categories?.[0] ?? null,
        evidenceContext: snapshot.evidenceContext?.promptText ?? null,
      }).catch((err) => {
        console.warn("[AI][PublishingAnalysis] failed, skipping", {
          projectId: existing.id,
          reason: options?.reason,
          error: err,
        });
        return null;
      }),
    ]);

    if (publishingResult) {
      generated.insight.publishingSceneTags = publishingResult.publishingSceneTags;
      generated.insight.publishingAnalysis = publishingResult.publishingAnalysis;
      generated.insight.publishingRelevance = publishingResult.publishingRelevance;
    }

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

    const updated = await saveProjectAIInsight(existing.id, {
      insight: generated.insight,
      completeness,
      signals,
      suggestedTags: generated.suggestedTags,
      suggestedCategories: generated.suggestedCategories,
      knowledge: generated.knowledge,
      sourceSnapshot: snapshot,
      sourceLevel,
    });
    await syncProjectPublishQualityFields(existing.id);

    return {
      projectId: existing.id,
      status: "success",
      insight: generated.insight,
      completeness,
      signals,
      suggestedTags: generated.suggestedTags,
      suggestedCategories: generated.suggestedCategories,
      sourceSnapshot: snapshot,
      sourceLevel,
      updatedAt: updated.aiInsightUpdatedAt ?? new Date(),
    };
  } catch (error) {
    const message = normalizeAiInsightError(error);
    await prisma.project.update({
      where: { id: existing.id },
      data: {
        aiInsightStatus: "failed",
        aiInsightError: message.slice(0, 300),
      },
    });
    throw new Error(message);
  }
}

import { enrichProjectWithAi } from "@/lib/ai/enrich-project";
import { isAiConfigured } from "@/lib/ai/ai-config";
import { suggestAdminProjectClassificationAndTags } from "@/lib/admin-project-classify-suggest";
import {
  buildProjectContentSourceSnapshot,
  generateProjectAIContent,
  saveProjectAIContent,
  type ProjectAIContent,
} from "@/lib/project-ai-content";
import { buildProjectEvidenceSnapshot } from "@/lib/project-evidence-snapshot";
import { detectAndPersistProjectUpdateSignals } from "@/lib/project-update-signals";
import { enrichProjectSources } from "@/lib/project-source-enrichment";
import {
  buildProjectInsightSourceSnapshot,
  computeProjectCompleteness,
  computeProjectSourceLevel,
  generateProjectAIInsight,
  saveProjectAIInsight,
  type ProjectAIInsight,
  type ProjectAISignals,
  type ProjectAISuggestedCategories,
} from "@/lib/project-ai-insight";
import {
  categoriesJsonFromKnowledge,
  knowledgeTagsForProject,
  knowledgeCategoryToProjectSlug,
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
  type ProjectKnowledge,
} from "@/lib/project-knowledge";
import { publishProjectAfterAiEnrichment, syncProjectPublishQualityFields } from "@/lib/project-publishing";
import { normalizeSuggestedTags } from "@/lib/tag-normalization";
import { normalizeChineseExpression, normalizeChineseList } from "@/lib/zh-normalization";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AiEnrichmentStage =
  | "config"
  | "source_enrichment"
  | "evidence"
  | "website_evidence"
  | "ai_insight"
  | "ai_content"
  | "apply_fields"
  | "publish"
  | "done";

export type EnrichProjectSource = "github_queue" | "chinese_indie" | "manual";

export type PostImportProjectAiResult = {
  success: boolean;
  stage: AiEnrichmentStage | string;
  aiInsightStatus: "success" | "failed" | "skipped";
  aiContentStatus: "success" | "failed" | "skipped";
  applyFieldsStatus: "success" | "failed" | "skipped";
  publishStatus: "success" | "failed" | "skipped";
  needsReview?: boolean;
  publishGuardReason?: string;
  error?: string;
  stack?: string;
  insightError?: string;
  contentError?: string;
  applyFieldsError?: string;
  publishError?: string;
};

function normalizeAiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }
  return String(error).slice(0, 500);
}

function shortStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) {
    return undefined;
  }
  return error.stack.split("\n").slice(0, 4).join("\n").slice(0, 400);
}

function aiNotConfiguredMessage(): string {
  return "AI 服务未配置，请设置 AI_API_KEY 或 DEEPSEEK_API_KEY（及 DEEPSEEK_MODEL_INSIGHT / DEEPSEEK_BASE_URL）";
}

function failResult(
  stage: AiEnrichmentStage | string,
  error: unknown,
  partial: Partial<PostImportProjectAiResult> = {},
): PostImportProjectAiResult {
  const message = normalizeAiError(error);
  return {
    success: false,
    stage,
    aiInsightStatus: partial.aiInsightStatus ?? "skipped",
    aiContentStatus: partial.aiContentStatus ?? "skipped",
    applyFieldsStatus: partial.applyFieldsStatus ?? "skipped",
    publishStatus: partial.publishStatus ?? "skipped",
    error: message,
    stack: shortStack(error),
    ...partial,
  };
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

async function applyRequiredProjectFields(input: {
  projectId: string;
  insight: ProjectAIInsight;
  knowledge: ProjectKnowledge;
  suggestedTags: string[];
  suggestedCategories: ProjectAISuggestedCategories;
  content: ProjectAIContent | null;
}): Promise<void> {
  const existing = await prisma.project.findFirst({
    where: { id: input.projectId, deletedAt: null },
    select: {
      name: true,
      tagline: true,
      description: true,
      simpleSummary: true,
      primaryCategory: true,
      tags: true,
      websiteUrl: true,
      githubUrl: true,
      aiCardSummary: true,
    },
  });
  if (!existing) {
    throw new Error("项目不存在或已删除");
  }

  const ruleSuggest = suggestAdminProjectClassificationAndTags({
    name: existing.name,
    tagline: existing.tagline ?? "",
    description: existing.description ?? "",
    websiteUrl: existing.websiteUrl ?? "",
    githubUrl: existing.githubUrl ?? "",
    aiCardSummary: existing.aiCardSummary ?? "",
  });

  const insight = input.insight;
  const tagline =
    (insight.summary?.trim()
      ? normalizeChineseExpression(insight.summary.trim()).slice(0, 200)
      : null) ||
    (insight.whatItIs?.trim()
      ? normalizeChineseExpression(insight.whatItIs.trim()).slice(0, 200)
      : null) ||
    existing.tagline?.trim() ||
    existing.description?.trim()?.slice(0, 200) ||
    existing.name;

  const description =
    buildDescriptionFromInsight(insight) ||
    existing.description?.trim() ||
    tagline;

  const simpleSummary =
    buildLongDescriptionFromContent(insight, input.content) ||
    existing.simpleSummary?.trim() ||
    description;

  let tags = knowledgeTagsForProject(input.knowledge, {
    projectName: existing.name,
    description: existing.description,
    useCases: input.insight.useCases,
  });
  if (!tags.length) {
    tags = normalizeSuggestedTags(input.suggestedTags);
  }
  if (!tags.length) {
    tags = normalizeSuggestedTags(ruleSuggest.tags);
  }
  if (!tags.length) {
    tags = ["独立开发者"];
  }

  const primaryCategory = (KNOWLEDGE_CATEGORIES as readonly string[]).includes(
    input.knowledge.primaryCategory,
  )
    ? knowledgeCategoryToProjectSlug(input.knowledge.primaryCategory as KnowledgeCategory)
    : input.knowledge.primaryCategory?.trim() || "other";
  const categories = categoriesJsonFromKnowledge(input.knowledge);

  await prisma.project.update({
    where: { id: input.projectId },
    data: {
      tagline,
      description,
      simpleSummary,
      primaryCategory,
      tags,
      ...(categories.length
        ? { categoriesJson: categories as unknown as Prisma.InputJsonValue }
        : {}),
      aiKnowledgeJson: input.knowledge as unknown as Prisma.InputJsonValue,
    },
  });
}

async function validateAppliedFields(projectId: string): Promise<string | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      tagline: true,
      description: true,
      simpleSummary: true,
      primaryCategory: true,
      tags: true,
      aiInsightStatus: true,
      aiContentStatus: true,
    },
  });
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
 * 导入后完整 AI enrichment（source enrichment → evidence → 认知卡 → 增强版 → 字段写入 → 可选发布）。
 */
export async function enrichProjectAfterImport(
  projectId: string,
  options?: { source?: EnrichProjectSource; skipPublish?: boolean },
): Promise<PostImportProjectAiResult> {
  console.info("[enrichProjectAfterImport] start", {
    projectId,
    source: options?.source ?? "manual",
    skipPublish: options?.skipPublish === true,
  });
  const result = await generatePostImportProjectAi(projectId, {
    skipPublish: options?.skipPublish === true,
  });
  console.info("[enrichProjectAfterImport] done", {
    projectId,
    source: options?.source ?? "manual",
    success: result.success,
    stage: result.stage,
  });
  return result;
}

/** 后台导入后不阻塞 UI，异步触发完整 enrichment。 */
export function scheduleEnrichProjectAfterImport(
  projectId: string,
  options?: { source?: EnrichProjectSource; skipPublish?: boolean },
): void {
  void enrichProjectAfterImport(projectId, options).catch((error) => {
    console.error("[scheduleEnrichProjectAfterImport] failed", {
      projectId,
      source: options?.source ?? "manual",
      error,
    });
  });
}

/**
 * 导入后完整 AI enrichment（source enrichment → evidence → 认知卡 → 增强版 → 字段写入 → 发布）。
 */
export async function generatePostImportProjectAi(
  projectId: string,
  options?: { skipPublish?: boolean },
): Promise<PostImportProjectAiResult> {
  const base: PostImportProjectAiResult = {
    success: false,
    stage: "evidence",
    aiInsightStatus: "skipped",
    aiContentStatus: "skipped",
    applyFieldsStatus: "skipped",
    publishStatus: "skipped",
  };

  if (!process.env.DATABASE_URL?.trim()) {
    return failResult("evidence", "未配置 DATABASE_URL", base);
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  if (!project) {
    return failResult("evidence", "项目不存在或已删除", base);
  }

  let cachedEvidenceSnapshot: Awaited<ReturnType<typeof buildProjectEvidenceSnapshot>> | null = null;

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
    return failResult("config", message, {
      ...base,
      stage: "config",
      aiInsightStatus: "failed",
      aiContentStatus: "failed",
    });
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

  base.stage = "source_enrichment";
  try {
    const enrichResult = await enrichProjectSources(projectId);
    console.info("[post-import-project-ai] source_enrichment", {
      projectId,
      added: enrichResult.addedSources.length,
      skipped: enrichResult.skippedSources.length,
      confidence: enrichResult.confidence,
      githubUrlUpdated: enrichResult.githubUrlUpdated,
      notes: enrichResult.notes,
    });
  } catch (error) {
    console.warn("[post-import-project-ai] source_enrichment failed (non-blocking)", {
      projectId,
      error,
    });
  }

  try {
    const evidenceSnapshot = await buildProjectEvidenceSnapshot(projectId);
    if (!evidenceSnapshot) {
      throw new Error("无法构建 evidence snapshot");
    }
    await detectAndPersistProjectUpdateSignals(projectId, evidenceSnapshot);
    cachedEvidenceSnapshot = evidenceSnapshot;
  } catch (error) {
    console.error("[post-import-project-ai] evidence failed", { projectId, error });
    return failResult("evidence", error, base);
  }

  let generatedInsight: Awaited<ReturnType<typeof generateProjectAIInsight>> | null = null;

  base.stage = "ai_insight";
  try {
    try {
      await enrichProjectWithAi(project.slug);
    } catch (error) {
      console.warn("[post-import-project-ai] base enrichProjectWithAi failed", { projectId, error });
    }

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
      knowledge: generatedInsight.knowledge,
      sourceSnapshot: snapshot,
      sourceLevel,
    });
    base.aiInsightStatus = "success";
  } catch (error) {
    const message = normalizeAiError(error);
    await prisma.project.update({
      where: { id: projectId },
      data: { aiInsightStatus: "failed", aiInsightError: message },
    });
    console.error("[post-import-project-ai] ai_insight failed", { projectId, error });
    return failResult("ai_insight", error, {
      ...base,
      aiInsightStatus: "failed",
      insightError: message,
    });
  }

  let generatedContent: ProjectAIContent | null = null;

  base.stage = "ai_content";
  try {
    const contentSnapshot = await buildProjectContentSourceSnapshot(projectId);
    if (!contentSnapshot) {
      throw new Error("项目不存在或已删除");
    }
    generatedContent = await generateProjectAIContent(contentSnapshot, { mode: "balanced" });
    await saveProjectAIContent(projectId, { content: generatedContent });
    base.aiContentStatus = "success";
  } catch (error) {
    const message = normalizeAiError(error);
    await prisma.project.update({
      where: { id: projectId },
      data: { aiContentStatus: "failed", aiContentError: message },
    });
    console.error("[post-import-project-ai] ai_content failed", { projectId, error });
    return failResult("ai_content", error, {
      ...base,
      aiContentStatus: "failed",
      contentError: message,
    });
  }

  base.stage = "apply_fields";
  try {
    if (!generatedInsight) {
      throw new Error("AI 认知卡结果缺失");
    }
    await applyRequiredProjectFields({
      projectId,
      insight: generatedInsight.insight,
      knowledge: generatedInsight.knowledge,
      suggestedTags: generatedInsight.suggestedTags,
      suggestedCategories: generatedInsight.suggestedCategories,
      content: generatedContent,
    });
    const applyValidation = await validateAppliedFields(projectId);
    if (applyValidation) {
      throw new Error(applyValidation);
    }
    base.applyFieldsStatus = "success";
    await prisma.project.update({
      where: { id: projectId },
      data: { aiError: null },
    });
    await syncProjectPublishQualityFields(projectId);
  } catch (error) {
    const message = normalizeAiError(error);
    console.error("[post-import-project-ai] apply_fields failed", { projectId, error });
    return failResult("apply_fields", error, {
      ...base,
      applyFieldsStatus: "failed",
      applyFieldsError: message,
    });
  }

  base.stage = "publish";
  if (options?.skipPublish) {
    base.publishStatus = "skipped";
    return {
      ...base,
      success: true,
      stage: "done",
    };
  }
  try {
    const publishResult = await publishProjectAfterAiEnrichment(projectId, {
      evidenceSnapshot: cachedEvidenceSnapshot,
    });
    if (publishResult.needsReview) {
      base.publishStatus = "skipped";
      base.needsReview = true;
      base.publishGuardReason = publishResult.guardReason ?? publishResult.error;
      console.warn("[post-import-project-ai] publish guard blocked auto publish", {
        projectId,
        reason: base.publishGuardReason,
      });
    } else if (!publishResult.ok) {
      throw new Error(publishResult.error ?? "自动发布失败");
    } else {
      base.publishStatus = "success";
    }
    await syncProjectPublishQualityFields(projectId);
  } catch (error) {
    const message = normalizeAiError(error);
    console.error("[post-import-project-ai] publish failed", { projectId, error });
    return failResult("publish", error, {
      ...base,
      publishStatus: "failed",
      publishError: message,
    });
  }

  return {
    ...base,
    success: true,
    stage: "done",
  };
}

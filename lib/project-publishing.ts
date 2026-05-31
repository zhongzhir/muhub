import type { Prisma } from "@prisma/client";

import type { ProjectEvidenceSnapshot } from "@/lib/project-evidence-snapshot";
import {
  resolveProjectInformation,
  type ProjectInformationResolverInput,
  type ResolvedProjectInformation,
} from "@/lib/project-information-resolver";
import { writeProjectActionLog } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";
import { isValidProjectSlug } from "@/lib/project-slug";

export type PublishProjectResult = {
  ok: boolean;
  error?: string;
  blockingErrors?: string[];
  needsReview?: boolean;
  guardReason?: string;
  publishQuality?: ProjectAiPublishQuality;
  needsEnhancement?: boolean;
  notice?: string;
};

export type ProjectAiPublishQuality = "full_ai" | "partial_ai" | "pending" | "failed";

export const PARTIAL_AI_PUBLISH_NOTICE =
  "AI 增强部分未完成，但项目已达到最小可展示发布标准";

export type PublishGuardInput = {
  evidenceSnapshot: ProjectEvidenceSnapshot | null;
  sources: Array<{ kind: string; label?: string | null; url?: string | null }>;
};

export type ProjectPublishReadinessInput = {
  id: string;
  name: string;
  slug: string;
  status: string;
  visibilityStatus?: string | null;
  publishedAt: Date | null;
  aiInsightStatus: string | null;
  aiInsight?: unknown;
  aiContentStatus: string | null;
  aiKnowledgeJson: unknown;
  aiStatus?: string | null;
  tagline: string | null;
  description: string | null;
  primaryCategory: string | null;
  aiCardSummary?: string | null;
  websiteUrl?: string | null;
  githubUrl?: string | null;
  sources?: ProjectInformationResolverInput["sources"];
  officialInfo?: ProjectInformationResolverInput["officialInfo"];
  evidenceSnapshot?: ProjectEvidenceSnapshot | null;
};

export type ProjectPublishReadiness = {
  outcome: "ready_full" | "ready_partial" | "blocked" | "skipped";
  publishQuality: ProjectAiPublishQuality;
  needsEnhancement: boolean;
  issues: string[];
  warnings: string[];
  notice?: string;
  primaryCategory: string;
};

export type BulkPublishItemResult = {
  id: string;
  name: string;
  slug: string;
  issues?: string[];
  warnings?: string[];
  reason?: string;
  notice?: string;
};

const MIN_EVIDENCE_COMPLETENESS = 35;

export function hasValidProjectKnowledgeJson(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return false;
  }
  const obj = raw as Record<string, unknown>;
  return typeof obj.primaryCategory === "string" && Boolean(obj.primaryCategory.trim());
}

export function resolveProjectAiPublishQuality(input: {
  aiInsightStatus?: string | null;
  aiContentStatus?: string | null;
  aiKnowledgeJson?: unknown | null;
  aiStatus?: string | null;
}): ProjectAiPublishQuality {
  if (input.aiInsightStatus === "success") {
    return hasValidProjectKnowledgeJson(input.aiKnowledgeJson) ? "full_ai" : "partial_ai";
  }
  if (input.aiInsightStatus === "failed") {
    return "failed";
  }
  if (input.aiStatus === "done_partial") {
    return "partial_ai";
  }
  if (input.aiStatus === "done") {
    return "full_ai";
  }
  return "pending";
}

export function projectNeedsAiEnhancement(input: {
  aiInsightStatus?: string | null;
  aiContentStatus?: string | null;
  aiKnowledgeJson?: unknown;
}): boolean {
  return input.aiInsightStatus === "success" && !hasValidProjectKnowledgeJson(input.aiKnowledgeJson);
}

function publishWarnings(
  input: ProjectPublishReadinessInput,
  resolved: ResolvedProjectInformation,
): string[] {
  const warnings = resolved.warnings.filter((warning) => !warning.includes("缺少可用 AI"));

  if (input.aiInsightStatus !== "success" && resolved.hasUsableKnowledge) {
    warnings.push("AI 认知卡内容存在，但状态未同步为 success");
  }
  if (input.aiContentStatus === "failed") {
    warnings.push("AI 增强版内容生成失败，已作为质量提示处理");
  } else if (input.aiContentStatus !== "success") {
    warnings.push("AI 增强版内容未生成，已作为质量提示处理");
  }
  if (!resolved.websiteUrl && !resolved.githubUrl && resolved.sourceList.length === 0) {
    warnings.push("未检测到官网、GitHub 或来源链接，建议后续补充");
  }

  return [...new Set(warnings)];
}

export function evaluateProjectPublishReadiness(
  input: ProjectPublishReadinessInput,
): ProjectPublishReadiness {
  const resolved = resolveProjectInformation(input);
  const issues: string[] = [];
  const warnings = publishWarnings(input, resolved);
  const primaryCategory = resolved.primaryCategory?.trim() || "other";

  if (input.status === "PUBLISHED") {
    return {
      outcome: "skipped",
      publishQuality: resolveProjectAiPublishQuality(input),
      needsEnhancement: projectNeedsAiEnhancement(input),
      issues: ["项目已发布"],
      warnings,
      primaryCategory,
    };
  }

  if (input.status === "ARCHIVED") {
    issues.push("项目已归档，不能发布");
  } else if (input.status !== "DRAFT" && input.status !== "READY") {
    issues.push(`项目状态为 ${input.status}，不能发布`);
  }

  if (!resolved.name.trim()) {
    issues.push("缺少项目名称");
  }

  if (!isValidProjectSlug(resolved.slug)) {
    issues.push("项目 slug 不合法");
  }

  if (!resolved.tagline?.trim() && !resolved.description?.trim()) {
    issues.push("至少需要一句话简介或项目简介");
  }

  if (!resolved.hasUsableKnowledge) {
    issues.push("缺少 AI 结构化分析 / 认知卡内容");
  }

  if (issues.length > 0) {
    return {
      outcome: "blocked",
      publishQuality: resolveProjectAiPublishQuality(input),
      needsEnhancement: projectNeedsAiEnhancement(input),
      issues,
      warnings,
      primaryCategory,
    };
  }

  const publishQuality = hasValidProjectKnowledgeJson(input.aiKnowledgeJson) ? "full_ai" : "partial_ai";
  const needsEnhancement = publishQuality === "partial_ai";

  if (publishQuality === "partial_ai") {
    return {
      outcome: "ready_partial",
      publishQuality,
      needsEnhancement,
      issues: [],
      warnings,
      notice: PARTIAL_AI_PUBLISH_NOTICE,
      primaryCategory,
    };
  }

  return {
    outcome: "ready_full",
    publishQuality: "full_ai",
    needsEnhancement: false,
    issues: [],
    warnings,
    primaryCategory,
  };
}

export async function syncProjectPublishQualityFields(projectId: string): Promise<void> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      aiInsightStatus: true,
      aiContentStatus: true,
      aiKnowledgeJson: true,
      aiStatus: true,
    },
  });
  if (!row) {
    return;
  }

  const publishQuality = resolveProjectAiPublishQuality(row);
  const nextStatus =
    publishQuality === "full_ai"
      ? "done"
      : publishQuality === "partial_ai"
        ? "done_partial"
        : row.aiStatus;

  if (nextStatus !== row.aiStatus) {
    await prisma.project.update({
      where: { id: projectId },
      data: { aiStatus: nextStatus, aiUpdatedAt: new Date() },
    });
  }
}

export function buildPublishProjectUpdateData(input: {
  publishedAt: Date | null;
  primaryCategory: string;
  readiness: ProjectPublishReadiness;
}): Prisma.ProjectUpdateInput {
  const now = new Date();
  return {
    status: "PUBLISHED",
    visibilityStatus: "PUBLISHED",
    isPublic: true,
    publishedAt: input.publishedAt ?? now,
    primaryCategory: input.primaryCategory,
    ...(input.readiness.publishQuality === "partial_ai"
      ? { aiStatus: "done_partial", aiUpdatedAt: now }
      : input.readiness.publishQuality === "full_ai"
        ? { aiStatus: "done", aiUpdatedAt: now }
        : {}),
    aiError: input.readiness.needsEnhancement ? PARTIAL_AI_PUBLISH_NOTICE : null,
  };
}

export function isCuratedOnlyProject(input: PublishGuardInput): boolean {
  const snapshot = input.evidenceSnapshot;
  if (!snapshot) {
    return false;
  }
  const hasGithub =
    Boolean(snapshot.github.url) &&
    snapshot.github.status !== "missing" &&
    Boolean(snapshot.github.description || snapshot.github.readmeSummary || snapshot.github.stars != null);
  const hasWebsite =
    Boolean(snapshot.website.url) &&
    snapshot.website.reachable &&
    snapshot.website.status !== "missing";
  if (hasGithub || hasWebsite) {
    return false;
  }
  const curatedOnlySources = input.sources.every(
    (source) =>
      source.label?.includes("curated_repository") ||
      source.kind === "WECHAT_ARTICLE" ||
      source.label?.includes("curated"),
  );
  return snapshot.curated.status !== "missing" && curatedOnlySources && input.sources.length > 0;
}

export function evaluatePublishGuard(input: PublishGuardInput): {
  canAutoPublish: boolean;
  needsReview: boolean;
  reason?: string;
} {
  const snapshot = input.evidenceSnapshot;
  if (!snapshot) {
    return {
      canAutoPublish: false,
      needsReview: true,
      reason: "缺少 evidence snapshot",
    };
  }

  if (isCuratedOnlyProject(input)) {
    return {
      canAutoPublish: false,
      needsReview: true,
      reason: "仅 curated 来源，禁止自动公开",
    };
  }

  const websiteReachable =
    Boolean(snapshot.website.url) &&
    snapshot.website.reachable &&
    snapshot.website.status !== "missing";
  const githubReachable =
    Boolean(snapshot.github.url) &&
    snapshot.github.status !== "missing" &&
    Boolean(snapshot.github.description || snapshot.github.readmeSummary || snapshot.github.stars != null);

  if (!websiteReachable && !githubReachable) {
    return {
      canAutoPublish: false,
      needsReview: true,
      reason: "官网与 GitHub 均不可达或证据不足",
    };
  }

  if (snapshot.confidence.evidenceCompleteness < MIN_EVIDENCE_COMPLETENESS) {
    return {
      canAutoPublish: false,
      needsReview: true,
      reason: `evidenceCompleteness ${snapshot.confidence.evidenceCompleteness} < ${MIN_EVIDENCE_COMPLETENESS}`,
    };
  }

  return { canAutoPublish: true, needsReview: false };
}

export async function publishProjectAfterAiEnrichment(
  projectId: string,
  options?: { evidenceSnapshot?: ProjectEvidenceSnapshot | null },
): Promise<PublishProjectResult> {
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
      status: true,
      visibilityStatus: true,
      aiInsight: true,
      aiInsightStatus: true,
      aiContentStatus: true,
      aiKnowledgeJson: true,
      aiStatus: true,
      officialInfo: {
        select: {
          summary: true,
          fullDescription: true,
          useCases: true,
          whoFor: true,
          website: true,
        },
      },
      sources: {
        select: {
          kind: true,
          url: true,
          label: true,
          title: true,
          summary: true,
          isPrimary: true,
          visibility: true,
        },
      },
    },
  });
  if (!row) {
    return { ok: false, error: "项目不存在或已删除" };
  }

  const readiness = evaluateProjectPublishReadiness({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    visibilityStatus: row.visibilityStatus,
    publishedAt: row.publishedAt,
    aiInsightStatus: row.aiInsightStatus,
    aiInsight: row.aiInsight,
    aiContentStatus: row.aiContentStatus,
    aiKnowledgeJson: row.aiKnowledgeJson,
    aiStatus: row.aiStatus,
    tagline: row.tagline,
    description: row.description,
    primaryCategory: row.primaryCategory,
    aiCardSummary: row.aiCardSummary,
    websiteUrl: row.websiteUrl,
    githubUrl: row.githubUrl,
    sources: row.sources,
    officialInfo: row.officialInfo,
    evidenceSnapshot: options?.evidenceSnapshot ?? null,
  });

  if (readiness.outcome === "blocked") {
    return {
      ok: false,
      needsReview: true,
      error: readiness.issues.join("；"),
      blockingErrors: readiness.issues,
    };
  }

  if (readiness.outcome === "skipped") {
    return { ok: true, needsReview: false, publishQuality: readiness.publishQuality };
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: row.id },
      data: buildPublishProjectUpdateData({
        publishedAt: row.publishedAt,
        primaryCategory: readiness.primaryCategory,
        readiness,
      }),
    });
    await writeProjectActionLog(
      {
        projectId: row.id,
        action: "publish",
        detail:
          readiness.publishQuality === "partial_ai"
            ? `自动发布（partial_ai）：${PARTIAL_AI_PUBLISH_NOTICE}`
            : "自动发布",
      },
      tx,
    );
  });

  return {
    ok: true,
    needsReview: false,
    publishQuality: readiness.publishQuality,
    needsEnhancement: readiness.needsEnhancement,
    notice: readiness.notice,
  };
}

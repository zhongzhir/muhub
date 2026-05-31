import { validateProjectForPublish, type ParsedAdminProjectInput } from "@/lib/admin-project-edit";
import type { ProjectEvidenceSnapshot } from "@/lib/project-evidence-snapshot";
import { writeProjectActionLog } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";
import { isValidProjectSlug } from "@/lib/project-slug";
import type { Prisma } from "@prisma/client";

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
  "AI增强部分未完成，但项目已达到公开质量标准";

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
  sources?: Array<{ kind: string; url?: string | null; label?: string | null }>;
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

function hasPublishSourceHint(input: ProjectPublishReadinessInput): boolean {
  if (input.websiteUrl?.trim() || input.githubUrl?.trim()) {
    return true;
  }
  return (input.sources ?? []).some((source) => {
    const url = source.url?.trim();
    if (!url) return false;
    return source.kind === "GITHUB" || source.kind === "GITEE" || source.kind === "WEBSITE" || source.kind === "OTHER";
  });
}

function hasTextValue(value: unknown): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

function hasUsefulObjectContent(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).some((item) => {
    if (typeof item === "string") {
      return Boolean(item.trim());
    }
    if (Array.isArray(item)) {
      return item.some((entry) => (typeof entry === "string" ? Boolean(entry.trim()) : Boolean(entry)));
    }
    return Boolean(item);
  });
}

function hasUsableAiInsight(input: ProjectPublishReadinessInput): boolean {
  return (
    input.aiInsightStatus === "success" ||
    hasUsefulObjectContent(input.aiInsight) ||
    hasValidProjectKnowledgeJson(input.aiKnowledgeJson) ||
    hasTextValue(input.aiCardSummary)
  );
}

function publishWarnings(input: ProjectPublishReadinessInput): string[] {
  const warnings: string[] = [];
  if (input.aiInsightStatus !== "success" && hasUsableAiInsight(input)) {
    warnings.push("AI 认知卡内容存在，但状态未同步为 success");
  }
  if (input.aiContentStatus === "failed") {
    warnings.push("AI 增强版内容生成失败，已作为质量提示处理");
  } else if (input.aiContentStatus !== "success") {
    warnings.push("AI 增强版内容未生成，已作为质量提示处理");
  }
  if (!hasPublishSourceHint(input)) {
    warnings.push("未检测到官网、GitHub 或来源链接，建议后续补充");
  }
  return warnings;
}

export function evaluateProjectPublishReadiness(
  input: ProjectPublishReadinessInput,
): ProjectPublishReadiness {
  const issues: string[] = [];
  const warnings = publishWarnings(input);
  const primaryCategory = input.primaryCategory?.trim() || "other";

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

  if (!input.name.trim()) {
    issues.push("缺少项目名称");
  }

  if (!isValidProjectSlug(input.slug)) {
    issues.push("项目 slug 不合法");
  }

  if (!input.tagline?.trim() && !input.description?.trim()) {
    issues.push("至少需要一句话简介或项目简介");
  }

  if (!hasUsableAiInsight(input)) {
    issues.push("缺少 AI 结构化分析/认知卡内容");
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

/**
 * 自动上架发布：与后台手动发布一致，不依赖 session / server action。
 */
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
      externalLinks: {
        select: { platform: true, url: true, label: true, isPrimary: true },
      },
      sources: {
        select: { kind: true, url: true, label: true },
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

  const parsed: ParsedAdminProjectInput = {
    name: row.name,
    slug: row.slug,
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
      needsReview: true,
      error: validation.blockingErrors.join("；"),
      blockingErrors: validation.blockingErrors,
    };
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
            ? `自动上架发布（partial_ai）：${PARTIAL_AI_PUBLISH_NOTICE}`
            : "chinese-independent-developer 自动上架发布",
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

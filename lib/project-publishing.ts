import { validateProjectForPublish, type ParsedAdminProjectInput } from "@/lib/admin-project-edit";
import type { ProjectEvidenceSnapshot } from "@/lib/project-evidence-snapshot";
import { writeProjectActionLog } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";
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
  publishedAt: Date | null;
  aiInsightStatus: string | null;
  aiContentStatus: string | null;
  aiKnowledgeJson: unknown;
  aiStatus?: string | null;
  tagline: string | null;
  description: string | null;
  primaryCategory: string | null;
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
  notice?: string;
  primaryCategory: string;
};

export type BulkPublishItemResult = {
  id: string;
  name: string;
  slug: string;
  issues?: string[];
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
  if (input.aiInsightStatus === "failed" || input.aiContentStatus === "failed" || input.aiStatus === "failed") {
    return "failed";
  }
  if (input.aiInsightStatus === "success" && input.aiContentStatus === "success") {
    return hasValidProjectKnowledgeJson(input.aiKnowledgeJson) ? "full_ai" : "partial_ai";
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
  return (
    input.aiInsightStatus === "success" &&
    input.aiContentStatus === "success" &&
    !hasValidProjectKnowledgeJson(input.aiKnowledgeJson)
  );
}

function hasProjectSourceUrl(input: ProjectPublishReadinessInput): boolean {
  if (input.websiteUrl?.trim() || input.githubUrl?.trim()) {
    return true;
  }
  return (input.sources ?? []).some((source) => {
    const url = source.url?.trim();
    if (!url) return false;
    return source.kind === "GITHUB" || source.kind === "GITEE" || source.kind === "WEBSITE" || source.kind === "OTHER";
  });
}

function evaluateReachabilityForPublish(input: ProjectPublishReadinessInput): string | null {
  if (input.evidenceSnapshot) {
    const guard = evaluatePublishGuard({
      evidenceSnapshot: input.evidenceSnapshot,
      sources: input.sources ?? [],
    });
    if (
      !guard.canAutoPublish &&
      (guard.reason?.includes("不可达") ||
        guard.reason?.includes("证据不足") ||
        guard.reason === "官网与 GitHub 均不可达或证据不足")
    ) {
      return guard.reason ?? "官网与 GitHub 均不可达或证据不足";
    }
    return null;
  }
  if (!hasProjectSourceUrl(input)) {
    return "官网与 GitHub 均不可达或证据不足";
  }
  return null;
}

export function evaluateProjectPublishReadiness(
  input: ProjectPublishReadinessInput,
): ProjectPublishReadiness {
  const issues: string[] = [];
  const primaryCategory = input.primaryCategory?.trim() || "other";

  if (input.status === "PUBLISHED") {
    return {
      outcome: "skipped",
      publishQuality: resolveProjectAiPublishQuality(input),
      needsEnhancement: projectNeedsAiEnhancement(input),
      issues: ["项目已发布"],
      primaryCategory,
    };
  }

  if (input.aiInsightStatus === "failed") {
    issues.push("AI 认知卡生成失败");
  } else if (input.aiInsightStatus !== "success") {
    issues.push("AI 认知卡未成功生成");
  }

  if (input.aiContentStatus === "failed") {
    issues.push("AI 增强版内容生成失败");
  } else if (input.aiContentStatus !== "success") {
    issues.push("AI 增强版内容未成功生成");
  }

  if (!input.tagline?.trim()) {
    issues.push("缺少一句话简介");
  }
  if (!input.description?.trim()) {
    issues.push("缺少项目简介");
  }

  const reachabilityIssue = evaluateReachabilityForPublish(input);
  if (reachabilityIssue) {
    issues.push(reachabilityIssue);
  }

  if (issues.length > 0) {
    return {
      outcome: "blocked",
      publishQuality: resolveProjectAiPublishQuality(input),
      needsEnhancement: projectNeedsAiEnhancement(input),
      issues,
      primaryCategory,
    };
  }

  const publishQuality = resolveProjectAiPublishQuality({
    aiInsightStatus: input.aiInsightStatus,
    aiContentStatus: input.aiContentStatus,
    aiKnowledgeJson: input.aiKnowledgeJson,
    aiStatus: input.aiStatus,
  });
  const needsEnhancement = publishQuality === "partial_ai";

  if (publishQuality === "partial_ai") {
    return {
      outcome: "ready_partial",
      publishQuality,
      needsEnhancement,
      issues: [],
      notice: PARTIAL_AI_PUBLISH_NOTICE,
      primaryCategory,
    };
  }

  return {
    outcome: "ready_full",
    publishQuality: "full_ai",
    needsEnhancement: false,
    issues: [],
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
    aiStatus: input.readiness.publishQuality === "partial_ai" ? "done_partial" : "done",
    aiUpdatedAt: now,
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
    publishedAt: row.publishedAt,
    aiInsightStatus: row.aiInsightStatus,
    aiContentStatus: row.aiContentStatus,
    aiKnowledgeJson: row.aiKnowledgeJson,
    aiStatus: row.aiStatus,
    tagline: row.tagline,
    description: row.description,
    primaryCategory: row.primaryCategory,
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

  const guard = evaluatePublishGuard({
    evidenceSnapshot: options?.evidenceSnapshot ?? null,
    sources: row.sources,
  });
  if (options?.evidenceSnapshot && !guard.canAutoPublish && guard.needsReview) {
    return {
      ok: false,
      needsReview: guard.needsReview,
      guardReason: guard.reason,
      error: guard.reason ?? "未满足自动发布条件",
    };
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

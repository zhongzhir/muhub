import { validateProjectForPublish, type ParsedAdminProjectInput } from "@/lib/admin-project-edit";
import type { ProjectEvidenceSnapshot } from "@/lib/project-evidence-snapshot";
import { writeProjectActionLog } from "@/lib/project-action-log";
import { prisma } from "@/lib/prisma";

export type PublishProjectResult = {
  ok: boolean;
  error?: string;
  blockingErrors?: string[];
  needsReview?: boolean;
  guardReason?: string;
};

export type PublishGuardInput = {
  evidenceSnapshot: ProjectEvidenceSnapshot | null;
  sources: Array<{ kind: string; label?: string | null; url?: string | null }>;
};

const MIN_EVIDENCE_COMPLETENESS = 35;

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

  const guard = evaluatePublishGuard({
    evidenceSnapshot: options?.evidenceSnapshot ?? null,
    sources: row.sources,
  });
  if (!guard.canAutoPublish) {
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

  return { ok: true, needsReview: false };
}

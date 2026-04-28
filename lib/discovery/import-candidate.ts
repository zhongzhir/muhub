import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { allocateUniqueProjectSlug } from "@/lib/project-allocate-slug";
import { tagsFromJson } from "@/lib/discovery/score-candidate";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { parseProjectSourceUrl } from "@/lib/project-source-url";
import { scheduleProjectAiEnrichment } from "@/lib/ai/enrich-project";
import {
  buildAcceptedEnrichmentLinkSpecs,
  buildCoreCandidateLinkSpecs,
  DISCOVERY_ENRICHMENT_LINK_SOURCE,
  mergeDiscoveryBoolField,
  mergedCategoriesForProjectUpdate,
  mergedTagsForProject,
  primaryFromCategories,
  projectCreateClassificationSlice,
} from "@/lib/discovery/sync-discovery-to-project";
import { persistReviewPriorityForCandidateId } from "@/lib/discovery/persist-review-priority";
import { writeProjectActionLog } from "@/lib/project-action-log";
import {
  inferReferenceSourcesFromCandidate,
  mergeReferenceSources,
} from "@/lib/discovery/reference-sources";

function taglineFromSummary(summary: string | null | undefined): string | null {
  if (!summary?.trim()) {
    return null;
  }
  const t = summary.trim();
  if (t.length <= 200) {
    return t;
  }
  return `${t.slice(0, 197)}…`;
}

async function createExternalLinks(
  tx: Prisma.TransactionClient,
  projectId: string,
  specs: Array<{ platform: string; url: string; label?: string | null; isPrimary?: boolean }>,
  sourceLabel: string,
): Promise<void> {
  const seen = new Set<string>();
  for (const s of specs) {
    const url = s.url.trim();
    if (!url) {
      continue;
    }
    const key = `${s.platform}:${url.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const exists = await tx.projectExternalLink.findFirst({
      where: { projectId, url },
      select: { id: true },
    });
    if (exists) {
      continue;
    }
    await tx.projectExternalLink.create({
      data: {
        projectId,
        platform: s.platform,
        url,
        label: s.label ?? null,
        isPrimary: s.isPrimary ?? false,
        source: sourceLabel,
      },
    });
  }
}

export async function approveDiscoveryCandidateImport(
  candidateId: string,
  reviewerUserId: string,
): Promise<{ projectId: string; slug: string }> {
  const cand = await prisma.discoveryCandidate.findUnique({
    where: { id: candidateId },
    include: {
      source: { select: { key: true, type: true } },
      enrichmentLinks: { select: { platform: true, url: true, isAccepted: true } },
    },
  });
  if (!cand) {
    throw new Error("候选不存在");
  }
  if (cand.importStatus === "IMPORTED" && cand.matchedProjectId) {
    throw new Error("该候选已导入");
  }
  if (cand.reviewStatus === "REJECTED" || cand.reviewStatus === "IGNORED") {
    throw new Error("已拒绝或已忽略的候选不可再导入为新项目");
  }

  const slug = await allocateUniqueProjectSlug(cand.slugCandidate ?? cand.title);
  const tags = tagsFromJson(cand.tagsJson);
  const name = cand.title.trim();
  const tagline = taglineFromSummary(cand.summary);
  const description =
    cand.summary?.trim() || cand.descriptionRaw?.trim()
      ? (cand.summary?.trim() || cand.descriptionRaw?.trim())!
      : null;
  const referenceSources = mergeReferenceSources(
    cand.referenceSources,
    inferReferenceSourcesFromCandidate({
      externalUrl: cand.externalUrl,
      website: cand.website,
      repoUrl: cand.repoUrl,
      docsUrl: cand.docsUrl,
      twitterUrl: cand.twitterUrl,
      sourceName: cand.source.key,
    }),
  );

  let githubUrl: string | null = null;
  let repoSource:
    | { kind: "GITHUB"; url: string; label: "GitHub" }
    | { kind: "OTHER"; url: string; label: "GitCC" }
    | null = null;
  if (cand.repoUrl?.trim()) {
    const source = parseProjectSourceUrl(cand.repoUrl);
    if (source?.type === "GITHUB") {
      try {
        githubUrl = normalizeGithubRepoUrl(cand.repoUrl);
      } catch {
        githubUrl = source.url;
      }
      repoSource = { kind: "GITHUB", url: githubUrl, label: "GitHub" };
    } else if (source?.type === "GITCC") {
      repoSource = { kind: "OTHER", url: source.url, label: "GitCC" };
    }
  }
  let websiteUrl: string | null = null;
  if (cand.website?.trim()) {
    try {
      websiteUrl = new URL(cand.website.trim()).href;
    } catch {
      websiteUrl = null;
    }
  }

  const sourceKey = cand.source.key;
  const discoveredAt = new Date();
  const classifySlice = projectCreateClassificationSlice(cand);

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name,
        slug,
        tagline,
        description,
        simpleSummary: tagline,
        tags,
        logoUrl: cand.avatarUrl?.trim() || null,
        websiteUrl,
        githubUrl,
        referenceSources: referenceSources as unknown as Prisma.InputJsonValue,
        sourceType: "discovery-v2",
        status: "DRAFT",
        isPublic: false,
        visibilityStatus: "DRAFT",
        discoverySource: cand.source.type,
        discoverySourceId: sourceKey,
        discoveredAt,
        importedFromCandidateId: cand.id,
        ...classifySlice,
        sources: repoSource
          ? {
              create: {
                kind: repoSource.kind,
                url: repoSource.url,
                label: repoSource.label,
                isPrimary: true,
              },
            }
          : undefined,
      },
    });

    await createExternalLinks(tx, project.id, buildCoreCandidateLinkSpecs(cand), "discovery-approve");
    await createExternalLinks(
      tx,
      project.id,
      buildAcceptedEnrichmentLinkSpecs(cand.enrichmentLinks),
      DISCOVERY_ENRICHMENT_LINK_SOURCE,
    );

    await tx.discoveryCandidate.update({
      where: { id: cand.id },
      data: {
        status: "APPROVED",
        reviewStatus: "APPROVED",
        importStatus: "IMPORTED",
        matchedProjectId: project.id,
        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
      },
    });

    await writeProjectActionLog(
      {
        projectId: project.id,
        action: "import",
        detail: `从 discovery 收录：candidate=${cand.id}`,
      },
      tx,
    );

    return { projectId: project.id, slug: project.slug };
  });

  scheduleProjectAiEnrichment(result.slug);
  await persistReviewPriorityForCandidateId(prisma, candidateId);
  return result;
}

/** 运营忽略：与 REJECTED 区分，importStatus 置 SKIPPED */
export async function ignoreDiscoveryCandidate(
  candidateId: string,
  reviewerUserId: string,
): Promise<void> {
  const cand = await prisma.discoveryCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, importStatus: true },
  });
  if (!cand) {
    throw new Error("候选不存在");
  }
  if (cand.importStatus === "IMPORTED") {
    throw new Error("已导入的记录不可再标记忽略");
  }
  await prisma.discoveryCandidate.update({
    where: { id: candidateId },
    data: {
      reviewStatus: "IGNORED",
      importStatus: "SKIPPED",
      reviewedById: reviewerUserId,
      reviewedAt: new Date(),
    },
  });
  await persistReviewPriorityForCandidateId(prisma, candidateId);
}

export async function rejectDiscoveryCandidate(
  candidateId: string,
  reviewerUserId: string,
  note?: string | null,
): Promise<void> {
  const cand = await prisma.discoveryCandidate.findUnique({
    where: { id: candidateId },
    select: { id: true, importStatus: true },
  });
  if (!cand) {
    throw new Error("候选不存在");
  }
  if (cand.importStatus === "IMPORTED") {
    throw new Error("已导入的记录请使用运营流程处理，勿改拒绝态");
  }
  await prisma.discoveryCandidate.update({
    where: { id: candidateId },
    data: {
      status: "REJECTED",
      reviewStatus: "REJECTED",
      importStatus: "SKIPPED",
      reviewedById: reviewerUserId,
      reviewedAt: new Date(),
      reviewNote: note?.trim() || null,
    },
  });
  await persistReviewPriorityForCandidateId(prisma, candidateId);
}

export async function mergeDiscoveryCandidateToProject(
  candidateId: string,
  projectId: string,
  reviewerUserId: string,
): Promise<void> {
  const cand = await prisma.discoveryCandidate.findUnique({
    where: { id: candidateId },
    include: {
      source: { select: { type: true, key: true } },
      enrichmentLinks: { select: { platform: true, url: true, isAccepted: true } },
    },
  });
  if (!cand) {
    throw new Error("候选不存在");
  }
  if (cand.importStatus === "IMPORTED") {
    throw new Error("该候选已处理");
  }
  if (cand.reviewStatus === "REJECTED" || cand.reviewStatus === "IGNORED") {
    throw new Error("已拒绝或已忽略的候选不可合并");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      slug: true,
      tags: true,
      categoriesJson: true,
      primaryCategory: true,
      isAiRelated: true,
      isChineseTool: true,
      discoverySource: true,
      discoverySourceId: true,
      referenceSources: true,
    },
  });
  if (!project) {
    throw new Error("目标项目不存在或已删除");
  }

  await prisma.$transaction(async (tx) => {
    const mergedCats = mergedCategoriesForProjectUpdate(project.categoriesJson, cand);
    const mergedTags = mergedTagsForProject(project.tags, cand);
    const accepted = cand.classificationStatus === "ACCEPTED";

    const data: Prisma.ProjectUpdateInput = {
      tags: mergedTags,
      referenceSources: mergeReferenceSources(
        project.referenceSources,
        mergeReferenceSources(
          cand.referenceSources,
          inferReferenceSourcesFromCandidate({
            externalUrl: cand.externalUrl,
            website: cand.website,
            repoUrl: cand.repoUrl,
            docsUrl: cand.docsUrl,
            twitterUrl: cand.twitterUrl,
            sourceName: cand.source.key,
          }),
        ),
      ) as unknown as Prisma.InputJsonValue,
    };

    if (accepted) {
      data.categoriesJson = mergedCats as unknown as Prisma.InputJsonValue;
      if (!project.primaryCategory) {
        const p = primaryFromCategories(mergedCats);
        if (p) {
          data.primaryCategory = p;
        }
      }
      data.isAiRelated = mergeDiscoveryBoolField(project.isAiRelated, cand.isAiRelated);
      data.isChineseTool = mergeDiscoveryBoolField(project.isChineseTool, cand.isChineseTool);
    }

    if (!project.discoverySource?.trim() && !project.discoverySourceId?.trim()) {
      data.discoverySource = cand.source.type;
      data.discoverySourceId = cand.source.key;
      data.discoveredAt = new Date();
    }

    await tx.project.update({
      where: { id: project.id },
      data,
    });

    await createExternalLinks(tx, project.id, buildCoreCandidateLinkSpecs(cand), "discovery-merge");
    await createExternalLinks(
      tx,
      project.id,
      buildAcceptedEnrichmentLinkSpecs(cand.enrichmentLinks),
      DISCOVERY_ENRICHMENT_LINK_SOURCE,
    );

    await tx.discoveryCandidate.update({
      where: { id: cand.id },
      data: {
        status: "MERGED",
        reviewStatus: "MERGED",
        importStatus: "IMPORTED",
        matchedProjectId: project.id,
        reviewedById: reviewerUserId,
        reviewedAt: new Date(),
      },
    });
  });

  await persistReviewPriorityForCandidateId(prisma, candidateId);
}

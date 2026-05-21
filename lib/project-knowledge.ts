import type { Prisma } from "@prisma/client";

import type { ProjectEvidenceSnapshot, CoverageLevel } from "@/lib/project-evidence-snapshot";
import { normalizePrimaryCategoryToSlug, type ProjectCategory } from "@/lib/projects/project-categories";
import { normalizeSuggestedCategories, normalizeSuggestedTags } from "@/lib/tag-normalization";
import { prisma } from "@/lib/prisma";
import type { ProjectAISuggestedCategories } from "@/lib/project-ai-insight";

export type ProjectKnowledgeCoverage = {
  github?: CoverageLevel;
  website?: CoverageLevel;
  docs?: CoverageLevel;
  social?: CoverageLevel;
  curated?: CoverageLevel;
};

export type ProjectKnowledgeStatusSignals = {
  githubActive?: boolean;
  websiteReachable?: boolean;
  recentUpdate?: boolean;
};

export type ProjectKnowledge = {
  version: "v1";
  primaryCategory: string;
  secondaryCategories?: string[];
  projectType?: string;
  targetUsers?: string[];
  platforms?: string[];
  techSignals?: string[];
  distributionChannels?: string[];
  monetizationSignals?: string[];
  statusSignals?: ProjectKnowledgeStatusSignals;
  sourceCoverage?: ProjectKnowledgeCoverage;
  generatedAt: string;
};

function asStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, max);
}

function asCoverageLevel(value: unknown): CoverageLevel | undefined {
  if (value === "full" || value === "partial" || value === "missing") {
    return value;
  }
  return undefined;
}

function normalizeCategorySlug(raw: string | null | undefined, fallback: ProjectCategory = "other"): string {
  const slug = normalizePrimaryCategoryToSlug(raw ?? "");
  return slug ?? fallback;
}

export function normalizeProjectKnowledge(
  input: unknown,
  fallback?: {
    primaryCategory?: string | null;
    secondaryCategories?: string[];
    suggestedCategories?: ProjectAISuggestedCategories;
    evidenceSnapshot?: ProjectEvidenceSnapshot | null;
  },
): ProjectKnowledge {
  const obj = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const statusRaw =
    obj.statusSignals && typeof obj.statusSignals === "object"
      ? (obj.statusSignals as Record<string, unknown>)
      : {};
  const coverageRaw =
    obj.sourceCoverage && typeof obj.sourceCoverage === "object"
      ? (obj.sourceCoverage as Record<string, unknown>)
      : {};

  const normalizedCategories = normalizeSuggestedCategories({
    primary:
      (typeof obj.primaryCategory === "string" ? obj.primaryCategory : undefined) ??
      fallback?.suggestedCategories?.primary ??
      fallback?.primaryCategory ??
      undefined,
    secondary:
      (typeof obj.secondaryCategories === "string"
        ? obj.secondaryCategories
        : undefined) ??
      fallback?.suggestedCategories?.secondary,
    optional: Array.isArray(obj.secondaryCategories)
      ? asStringArray(obj.secondaryCategories, 5)
      : fallback?.suggestedCategories?.optional,
  });

  const primaryCategory = normalizeCategorySlug(
    normalizedCategories.primary ?? fallback?.primaryCategory,
    "other",
  );

  const secondaryFromAi = asStringArray(obj.secondaryCategories, 5);
  const secondaryCategories = [
    ...(normalizedCategories.secondary ? [normalizedCategories.secondary] : []),
    ...(normalizedCategories.optional ?? []),
    ...secondaryFromAi,
    ...(fallback?.secondaryCategories ?? []),
  ]
    .map((item) => normalizeCategorySlug(item, primaryCategory as ProjectCategory))
    .filter((item, index, arr) => item !== primaryCategory && arr.indexOf(item) === index)
    .slice(0, 5);

  const evidence = fallback?.evidenceSnapshot;
  const sourceCoverage: ProjectKnowledgeCoverage = {
    github: asCoverageLevel(coverageRaw.github) ?? evidence?.coverage.github,
    website: asCoverageLevel(coverageRaw.website) ?? evidence?.coverage.website,
    docs: asCoverageLevel(coverageRaw.docs) ?? evidence?.coverage.docs,
    social: asCoverageLevel(coverageRaw.social) ?? evidence?.coverage.social,
    curated: asCoverageLevel(coverageRaw.curated) ?? evidence?.coverage.curated,
  };

  return {
    version: "v1",
    primaryCategory,
    secondaryCategories: secondaryCategories.length ? secondaryCategories : undefined,
    projectType: typeof obj.projectType === "string" ? obj.projectType.trim().slice(0, 80) : undefined,
    targetUsers: asStringArray(obj.targetUsers, 8),
    platforms: asStringArray(obj.platforms, 8),
    techSignals: asStringArray(obj.techSignals, 10),
    distributionChannels: asStringArray(obj.distributionChannels, 8),
    monetizationSignals: asStringArray(obj.monetizationSignals, 6),
    statusSignals: {
      githubActive:
        typeof statusRaw.githubActive === "boolean"
          ? statusRaw.githubActive
          : evidence?.signals.githubActive ?? undefined,
      websiteReachable:
        typeof statusRaw.websiteReachable === "boolean"
          ? statusRaw.websiteReachable
          : evidence?.website.reachable ?? undefined,
      recentUpdate:
        typeof statusRaw.recentUpdate === "boolean" ? statusRaw.recentUpdate : undefined,
    },
    sourceCoverage,
    generatedAt:
      typeof obj.generatedAt === "string" && obj.generatedAt.trim()
        ? obj.generatedAt.trim()
        : new Date().toISOString(),
  };
}

export function buildProjectKnowledgeFromEvidence(input: {
  evidenceSnapshot: ProjectEvidenceSnapshot;
  suggestedCategories: ProjectAISuggestedCategories;
  suggestedTags?: string[];
  aiKnowledgePartial?: unknown;
}): ProjectKnowledge {
  const knowledge = normalizeProjectKnowledge(input.aiKnowledgePartial, {
    suggestedCategories: input.suggestedCategories,
    evidenceSnapshot: input.evidenceSnapshot,
  });

  if (!knowledge.targetUsers?.length && input.suggestedTags?.length) {
    knowledge.targetUsers = normalizeSuggestedTags(input.suggestedTags).slice(0, 6);
  }

  if (!knowledge.platforms?.length) {
    const platforms: string[] = [];
    if (input.evidenceSnapshot.website.url) platforms.push("web");
    if (input.evidenceSnapshot.github.url) platforms.push("github");
    if (input.evidenceSnapshot.sources.kinds.includes("OTHER")) {
      platforms.push("extension");
    }
    if (platforms.length) {
      knowledge.platforms = platforms;
    }
  }

  return knowledge;
}

export function knowledgeTagsForProject(knowledge: ProjectKnowledge): string[] {
  const tags = new Set<string>();
  for (const item of knowledge.targetUsers ?? []) {
    tags.add(item);
  }
  for (const item of knowledge.techSignals ?? []) {
    tags.add(item);
  }
  for (const item of knowledge.platforms ?? []) {
    tags.add(item);
  }
  return normalizeSuggestedTags([...tags]).slice(0, 12);
}

export function categoriesJsonFromKnowledge(knowledge: ProjectKnowledge): string[] {
  return [
    knowledge.primaryCategory,
    ...(knowledge.secondaryCategories ?? []),
  ].filter((item, index, arr) => Boolean(item?.trim()) && arr.indexOf(item) === index);
}

export async function saveProjectKnowledge(
  projectId: string,
  knowledge: ProjectKnowledge,
): Promise<void> {
  const categories = categoriesJsonFromKnowledge(knowledge);
  const tags = knowledgeTagsForProject(knowledge);
  await prisma.project.update({
    where: { id: projectId },
    data: {
      aiKnowledgeJson: knowledge as unknown as Prisma.InputJsonValue,
      primaryCategory: knowledge.primaryCategory,
      categoriesJson: categories as unknown as Prisma.InputJsonValue,
      tags,
    },
  });
}

export function parseProjectKnowledgeFromRow(raw: unknown): ProjectKnowledge | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  try {
    return normalizeProjectKnowledge(raw);
  } catch {
    return null;
  }
}

export const PROJECT_KNOWLEDGE_JSON_SCHEMA_EXAMPLE = {
  knowledge: {
    primaryCategory: "ai_agent",
    secondaryCategories: ["content_media"],
    projectType: "AI video generator",
    targetUsers: ["creator", "marketer"],
    platforms: ["web"],
    techSignals: ["multimodal", "video-generation"],
    distributionChannels: ["producthunt", "website"],
    monetizationSignals: ["freemium"],
    statusSignals: {
      githubActive: false,
      websiteReachable: true,
      recentUpdate: true,
    },
    sourceCoverage: {
      github: "missing",
      website: "full",
      docs: "partial",
      social: "missing",
      curated: "full",
    },
    generatedAt: new Date().toISOString(),
  },
};

import type { Prisma } from "@prisma/client";

import type { ProjectEvidenceSnapshot, CoverageLevel } from "@/lib/project-evidence-snapshot";
import { normalizePrimaryCategoryToSlug, type ProjectCategory } from "@/lib/projects/project-categories";
import { normalizeSuggestedCategories, normalizeSuggestedTags } from "@/lib/tag-normalization";
import { prisma } from "@/lib/prisma";
import type { ProjectAISuggestedCategories } from "@/lib/project-ai-insight";

export const KNOWLEDGE_CATEGORIES = [
  "AI_VIDEO",
  "AI_IMAGE",
  "AI_AGENT",
  "AI_WRITING",
  "DEV_TOOL",
  "PRODUCTIVITY",
  "SEARCH",
  "EDUCATION",
  "FINANCE",
  "DATA_TOOL",
] as const;

export const KNOWLEDGE_PLATFORMS = [
  "web",
  "ios",
  "android",
  "chrome_extension",
  "desktop",
  "api",
  "wechat",
] as const;

export const KNOWLEDGE_DISTRIBUTIONS = [
  "github",
  "producthunt",
  "chrome_store",
  "app_store",
  "wechat",
  "twitter",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export type KnowledgePlatform = (typeof KNOWLEDGE_PLATFORMS)[number];
export type KnowledgeDistribution = (typeof KNOWLEDGE_DISTRIBUTIONS)[number];

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

export type KnowledgeValidationAction =
  | { field: string; action: "normalize"; from: string; to: string }
  | { field: string; action: "fallback"; from: string; to: string }
  | { field: string; action: "discard"; from: string };

const KNOWLEDGE_CATEGORY_ALIASES: Record<string, KnowledgeCategory> = {
  ai_video: "AI_VIDEO",
  "ai video": "AI_VIDEO",
  video: "AI_VIDEO",
  content_media: "AI_VIDEO",
  ai_image: "AI_IMAGE",
  "ai image": "AI_IMAGE",
  image: "AI_IMAGE",
  design_creative: "AI_IMAGE",
  ai_agent: "AI_AGENT",
  "ai agent": "AI_AGENT",
  ai_agents: "AI_AGENT",
  ai_writing: "AI_WRITING",
  writing: "AI_WRITING",
  dev_tool: "DEV_TOOL",
  developer_tool: "DEV_TOOL",
  "dev tool": "DEV_TOOL",
  productivity: "PRODUCTIVITY",
  search: "SEARCH",
  education: "EDUCATION",
  education_learning: "EDUCATION",
  finance: "FINANCE",
  finance_investment: "FINANCE",
  data_tool: "DATA_TOOL",
  data_model: "DATA_TOOL",
  infrastructure: "DATA_TOOL",
};

const KNOWLEDGE_CATEGORY_TO_PROJECT_SLUG: Record<KnowledgeCategory, ProjectCategory> = {
  AI_VIDEO: "content_media",
  AI_IMAGE: "design_creative",
  AI_AGENT: "ai_agent",
  AI_WRITING: "content_media",
  DEV_TOOL: "developer_tool",
  PRODUCTIVITY: "productivity",
  SEARCH: "other",
  EDUCATION: "education_learning",
  FINANCE: "finance_investment",
  DATA_TOOL: "data_model",
};

const PLATFORM_ALIASES: Record<string, KnowledgePlatform> = {
  web: "web",
  website: "web",
  ios: "ios",
  iphone: "ios",
  ipad: "ios",
  android: "android",
  chrome_extension: "chrome_extension",
  "chrome extension": "chrome_extension",
  extension: "chrome_extension",
  desktop: "desktop",
  mac: "desktop",
  windows: "desktop",
  api: "api",
  wechat: "wechat",
  weixin: "wechat",
  github: "web",
};

const DISTRIBUTION_ALIASES: Record<string, KnowledgeDistribution> = {
  github: "github",
  producthunt: "producthunt",
  "product hunt": "producthunt",
  chrome_store: "chrome_store",
  "chrome store": "chrome_store",
  chromewebstore: "chrome_store",
  app_store: "app_store",
  "app store": "app_store",
  ios_store: "app_store",
  wechat: "wechat",
  twitter: "twitter",
  x: "twitter",
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

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function resolveKnowledgeCategory(
  raw: string | null | undefined,
  fallback: KnowledgeCategory,
  actions: KnowledgeValidationAction[],
): KnowledgeCategory {
  if (!raw?.trim()) {
    actions.push({ field: "primaryCategory", action: "fallback", from: "", to: fallback });
    return fallback;
  }
  const token = normalizeToken(raw);
  if ((KNOWLEDGE_CATEGORIES as readonly string[]).includes(raw.trim())) {
    return raw.trim() as KnowledgeCategory;
  }
  const mapped = KNOWLEDGE_CATEGORY_ALIASES[token] ?? KNOWLEDGE_CATEGORY_ALIASES[raw.trim().toLowerCase()];
  if (mapped) {
    if (mapped !== raw.trim()) {
      actions.push({ field: "primaryCategory", action: "normalize", from: raw, to: mapped });
    }
    return mapped;
  }
  const slug = normalizePrimaryCategoryToSlug(raw);
  if (slug) {
    const fromSlug = KNOWLEDGE_CATEGORY_ALIASES[slug];
    if (fromSlug) {
      actions.push({ field: "primaryCategory", action: "normalize", from: raw, to: fromSlug });
      return fromSlug;
    }
  }
  actions.push({ field: "primaryCategory", action: "fallback", from: raw, to: fallback });
  return fallback;
}

function normalizeEnumList<T extends string>(
  values: string[] | undefined,
  allowed: readonly T[],
  aliases: Record<string, T>,
  field: string,
  actions: KnowledgeValidationAction[],
): T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const raw of values ?? []) {
    const token = normalizeToken(raw);
    let resolved: T | null = null;
    if ((allowed as readonly string[]).includes(raw.trim())) {
      resolved = raw.trim() as T;
    } else if (aliases[token]) {
      resolved = aliases[token];
      actions.push({ field, action: "normalize", from: raw, to: resolved });
    } else if (aliases[raw.trim().toLowerCase()]) {
      resolved = aliases[raw.trim().toLowerCase()];
      actions.push({ field, action: "normalize", from: raw, to: resolved });
    }
    if (!resolved) {
      actions.push({ field, action: "discard", from: raw });
      continue;
    }
    if (!seen.has(resolved)) {
      seen.add(resolved);
      out.push(resolved);
    }
  }
  return out.slice(0, 8);
}

export function knowledgeCategoryToProjectSlug(category: KnowledgeCategory): ProjectCategory {
  return KNOWLEDGE_CATEGORY_TO_PROJECT_SLUG[category];
}

export function validateProjectKnowledge(
  input: ProjectKnowledge,
  options?: { fallbackCategory?: KnowledgeCategory },
): { knowledge: ProjectKnowledge; actions: KnowledgeValidationAction[] } {
  const actions: KnowledgeValidationAction[] = [];
  const fallbackCategory = options?.fallbackCategory ?? "DEV_TOOL";

  const primaryCategory = resolveKnowledgeCategory(
    input.primaryCategory,
    fallbackCategory,
    actions,
  );

  const secondaryCategories = normalizeEnumList(
    input.secondaryCategories,
    KNOWLEDGE_CATEGORIES,
    KNOWLEDGE_CATEGORY_ALIASES,
    "secondaryCategories",
    actions,
  );

  const platforms = normalizeEnumList(
    input.platforms,
    KNOWLEDGE_PLATFORMS,
    PLATFORM_ALIASES,
    "platforms",
    actions,
  );

  const distributionChannels = normalizeEnumList(
    input.distributionChannels,
    KNOWLEDGE_DISTRIBUTIONS,
    DISTRIBUTION_ALIASES,
    "distributionChannels",
    actions,
  );

  const knowledge: ProjectKnowledge = {
    ...input,
    primaryCategory,
    secondaryCategories: secondaryCategories.length ? secondaryCategories : undefined,
    platforms: platforms.length ? platforms : undefined,
    distributionChannels: distributionChannels.length ? distributionChannels : undefined,
    targetUsers: asStringArray(input.targetUsers, 8),
    techSignals: asStringArray(input.techSignals, 10),
    monetizationSignals: asStringArray(input.monetizationSignals, 6),
  };

  return { knowledge, actions };
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

  const draft: ProjectKnowledge = {
    version: "v1",
    primaryCategory:
      normalizedCategories.primary ??
      fallback?.primaryCategory ??
      fallback?.suggestedCategories?.primary ??
      "DEV_TOOL",
    secondaryCategories: [
      ...(normalizedCategories.secondary ? [normalizedCategories.secondary] : []),
      ...(normalizedCategories.optional ?? []),
      ...asStringArray(obj.secondaryCategories, 5),
      ...(fallback?.secondaryCategories ?? []),
    ],
    projectType: typeof obj.projectType === "string" ? obj.projectType.trim().slice(0, 80) : undefined,
    targetUsers: asStringArray(obj.targetUsers, 8),
    platforms: asStringArray(obj.platforms, 8),
    techSignals: asStringArray(obj.techSignals, 10),
    distributionChannels: asStringArray(obj.distributionChannels, 8),
    monetizationSignals: asStringArray(obj.monetizationSignals, 6),
    statusSignals: {},
    sourceCoverage: {},
    generatedAt:
      typeof obj.generatedAt === "string" && obj.generatedAt.trim()
        ? obj.generatedAt.trim()
        : new Date().toISOString(),
  };

  const evidence = fallback?.evidenceSnapshot;
  draft.statusSignals = {
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
  };
  draft.sourceCoverage = {
    github: asCoverageLevel(coverageRaw.github) ?? evidence?.coverage.github,
    website: asCoverageLevel(coverageRaw.website) ?? evidence?.coverage.website,
    docs: asCoverageLevel(coverageRaw.docs) ?? evidence?.coverage.docs,
    social: asCoverageLevel(coverageRaw.social) ?? evidence?.coverage.social,
    curated: asCoverageLevel(coverageRaw.curated) ?? evidence?.coverage.curated,
  };

  const validated = validateProjectKnowledge(draft, {
    fallbackCategory: "DEV_TOOL",
  });
  validated.knowledge.secondaryCategories = validated.knowledge.secondaryCategories
    ?.filter((item, index, arr) => item !== validated.knowledge.primaryCategory && arr.indexOf(item) === index)
    .slice(0, 5);

  return validated.knowledge;
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
    const platforms: KnowledgePlatform[] = [];
    if (input.evidenceSnapshot.website.url) platforms.push("web");
    if (input.evidenceSnapshot.sources.kinds.includes("WECHAT")) {
      platforms.push("wechat");
    }
    if (platforms.length) {
      knowledge.platforms = platforms;
    }
  }

  return validateProjectKnowledge(knowledge).knowledge;
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
  const primarySlug = (KNOWLEDGE_CATEGORIES as readonly string[]).includes(knowledge.primaryCategory)
    ? knowledgeCategoryToProjectSlug(knowledge.primaryCategory as KnowledgeCategory)
    : normalizeCategorySlug(knowledge.primaryCategory, "other");
  const secondarySlugs = (knowledge.secondaryCategories ?? []).map((item) =>
    (KNOWLEDGE_CATEGORIES as readonly string[]).includes(item)
      ? knowledgeCategoryToProjectSlug(item as KnowledgeCategory)
      : normalizeCategorySlug(item, primarySlug as ProjectCategory),
  );
  return [primarySlug, ...secondarySlugs].filter(
    (item, index, arr) => Boolean(item?.trim()) && arr.indexOf(item) === index,
  );
}

export async function saveProjectKnowledge(
  projectId: string,
  knowledge: ProjectKnowledge,
): Promise<void> {
  const validated = validateProjectKnowledge(knowledge);
  const categories = categoriesJsonFromKnowledge(validated.knowledge);
  const tags = knowledgeTagsForProject(validated.knowledge);
  const primarySlug = (KNOWLEDGE_CATEGORIES as readonly string[]).includes(
    validated.knowledge.primaryCategory,
  )
    ? knowledgeCategoryToProjectSlug(validated.knowledge.primaryCategory as KnowledgeCategory)
    : normalizeCategorySlug(validated.knowledge.primaryCategory, "other");

  await prisma.project.update({
    where: { id: projectId },
    data: {
      aiKnowledgeJson: validated.knowledge as unknown as Prisma.InputJsonValue,
      primaryCategory: primarySlug,
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
    primaryCategory: "AI_AGENT",
    secondaryCategories: ["AI_VIDEO"],
    projectType: "AI video generator",
    targetUsers: ["creator", "marketer"],
    platforms: ["web"],
    techSignals: ["multimodal", "video-generation"],
    distributionChannels: ["producthunt", "github"],
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

/**
 * 正式 Project 完整度（规则化、可解释），供广场推荐排序与运营后台使用。
 */

export type ProjectCompletenessSignals = {
  hasTitle: boolean;
  hasSummary: boolean;
  hasPrimaryCategory: boolean;
  hasTags: boolean;
  hasWebsite: boolean;
  hasGitHub: boolean;
  hasDocs: boolean;
  hasExternalLinks: boolean;
};

export type ProjectCompletenessResult = {
  completenessScore: number;
  completenessSignals: ProjectCompletenessSignals;
};

const SIGNAL_KEYS = Object.keys({
  hasTitle: true,
  hasSummary: true,
  hasPrimaryCategory: true,
  hasTags: true,
  hasWebsite: true,
  hasGitHub: true,
  hasDocs: true,
  hasExternalLinks: true,
} satisfies ProjectCompletenessSignals) as (keyof ProjectCompletenessSignals)[];

export type ProjectCompletenessInput = {
  name: string;
  tagline: string | null;
  description: string | null;
  primaryCategory: string | null;
  tags: string[];
  websiteUrl: string | null;
  githubUrl: string | null;
  /** 除 websiteUrl 外是否存在 WEBSITE 类信息源 */
  hasWebsiteSource: boolean;
  /** 除 githubUrl 外是否存在 GITHUB/GITEE 源 */
  hasGithubSource: boolean;
  docsUrlsCount: number;
  externalLinksCount: number;
};

export function computeProjectCompleteness(input: ProjectCompletenessInput): ProjectCompletenessResult {
  const hasTitle = input.name.trim().length > 0;
  const hasSummary = Boolean(input.tagline?.trim() || input.description?.trim());
  const hasPrimaryCategory = Boolean(input.primaryCategory?.trim());
  const hasTags = input.tags.length > 0;
  const hasWebsite =
    Boolean(input.websiteUrl?.trim()) || Boolean(input.hasWebsiteSource);
  const hasGitHub =
    Boolean(input.githubUrl?.trim()) || Boolean(input.hasGithubSource);
  const hasDocs = input.docsUrlsCount > 0;
  const hasExternalLinks = input.externalLinksCount > 0;

  const completenessSignals: ProjectCompletenessSignals = {
    hasTitle,
    hasSummary,
    hasPrimaryCategory,
    hasTags,
    hasWebsite,
    hasGitHub,
    hasDocs,
    hasExternalLinks,
  };

  const n = SIGNAL_KEYS.filter((k) => completenessSignals[k]).length;
  const completenessScore = Math.round((n / SIGNAL_KEYS.length) * 100);

  return { completenessScore, completenessSignals };
}

/** 发布/公开前的轻量提醒文案（不阻断） */
export function publishReadinessMessages(result: ProjectCompletenessResult): string[] {
  const s = result.completenessSignals;
  const msgs: string[] = [];
  if (!s.hasWebsite) {
    msgs.push("建议补充官网链接，便于访问者了解项目。");
  }
  if (!s.hasDocs) {
    msgs.push("建议补充文档链接或 DOCS 信息源。");
  }
  if (!s.hasPrimaryCategory) {
    msgs.push("建议设置主类型（primaryCategory），便于在广场筛选与发现。");
  }
  if (!s.hasTags) {
    msgs.push("建议添加标签，便于搜索与归类。");
  }
  return msgs;
}

/** 从 Prisma 选出的关联行构造完整度输入（运营列表/发布提示共用） */
export function completenessInputFromParts(args: {
  name: string;
  tagline: string | null;
  description: string | null;
  primaryCategory: string | null;
  tags: string[];
  websiteUrl: string | null;
  githubUrl: string | null;
  sources: { kind: string }[];
  externalLinks: { platform: string }[];
}): ProjectCompletenessInput {
  const kinds = new Set(args.sources.map((s) => s.kind));
  const hasWebsiteSource = kinds.has("WEBSITE");
  const hasGithubSource = kinds.has("GITHUB") || kinds.has("GITEE");
  let hasDocs = kinds.has("DOCS");
  for (const e of args.externalLinks) {
    if (e.platform.toLowerCase() === "docs") {
      hasDocs = true;
      break;
    }
  }
  const docsUrlsCount = hasDocs ? 1 : 0;

  return {
    name: args.name,
    tagline: args.tagline,
    description: args.description,
    primaryCategory: args.primaryCategory,
    tags: args.tags,
    websiteUrl: args.websiteUrl,
    githubUrl: args.githubUrl,
    hasWebsiteSource,
    hasGithubSource,
    docsUrlsCount,
    externalLinksCount: args.externalLinks.length,
  };
}

/** 广场「推荐」排序用加权分（可解释，非个性化推荐） */
export function plazaRecommendedSortScore(
  completeness: ProjectCompletenessResult,
  extras: {
    isAiRelated: boolean | null;
    hasDocsSignal: boolean;
    hasWebsiteField: boolean;
  },
): number {
  let score = completeness.completenessScore;
  if (extras.isAiRelated === true) {
    score += 8;
  }
  if (extras.hasWebsiteField) {
    score += 5;
  }
  if (extras.hasDocsSignal) {
    score += 5;
  }
  if (completeness.completenessSignals.hasGitHub) {
    score += 3;
  }
  return score;
}

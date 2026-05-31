import {
  KNOWLEDGE_CATEGORIES,
  knowledgeCategoryToProjectSlug,
  knowledgeTagsForProject,
  parseProjectKnowledgeFromRow,
  type KnowledgeCategory,
  type ProjectKnowledge,
} from "@/lib/project-knowledge";

type SourceInput = {
  id?: string | null;
  kind: string;
  url?: string | null;
  label?: string | null;
  title?: string | null;
  content?: string | null;
  summary?: string | null;
  isPrimary?: boolean | null;
  visibility?: string | null;
};

type OfficialInfoInput = {
  summary?: string | null;
  fullDescription?: string | null;
  useCases?: unknown;
  whoFor?: unknown;
  website?: string | null;
};

export type ProjectInformationResolverInput = {
  name?: string | null;
  slug?: string | null;
  tagline?: string | null;
  description?: string | null;
  simpleSummary?: string | null;
  primaryCategory?: string | null;
  tags?: string[] | null;
  websiteUrl?: string | null;
  githubUrl?: string | null;
  aiCardSummary?: string | null;
  aiInsight?: unknown;
  aiInsightStatus?: string | null;
  aiKnowledgeJson?: unknown;
  sources?: SourceInput[] | null;
  officialInfo?: OfficialInfoInput | null;
};

export type ResolvedProjectSourceItem = {
  id?: string;
  kind: string;
  url: string;
  label?: string;
  title?: string | null;
  summary?: string | null;
  isPrimary: boolean;
};

export type ResolvedProjectInformation = {
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  primaryCategory: string | null;
  tags: string[];
  websiteUrl: string | null;
  githubUrl: string | null;
  sourceList: ResolvedProjectSourceItem[];
  hasUsableKnowledge: boolean;
  provenance: Record<
    "name" | "slug" | "tagline" | "description" | "primaryCategory" | "tags" | "websiteUrl" | "githubUrl",
    "official" | "knowledge" | "source" | "legacy" | "system" | "empty"
  >;
  warnings: string[];
};

function cleanText(value: unknown, max = 3000): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function asStringArray(value: unknown, max = 12): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: string[] = [];
  for (const item of value) {
    const text = cleanText(item, 80);
    if (!text || out.includes(text)) {
      continue;
    }
    out.push(text);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

function firstText(
  candidates: Array<{ value: unknown; source: ResolvedProjectInformation["provenance"]["tagline"] }>,
): { value: string | null; source: ResolvedProjectInformation["provenance"]["tagline"] } {
  for (const candidate of candidates) {
    const value = cleanText(candidate.value);
    if (value) {
      return { value, source: candidate.source };
    }
  }
  return { value: null, source: "empty" };
}

function insightObject(aiInsight: unknown): Record<string, unknown> {
  return aiInsight && typeof aiInsight === "object" && !Array.isArray(aiInsight)
    ? (aiInsight as Record<string, unknown>)
    : {};
}

function insightDescription(aiInsight: unknown): string | null {
  const insight = insightObject(aiInsight);
  const blocks: string[] = [];
  const whatItIs = cleanText(insight.whatItIs);
  const summary = cleanText(insight.summary);
  const whoFor = asStringArray(insight.whoFor, 5);
  const useCases = asStringArray(insight.useCases, 5);
  if (whatItIs) {
    blocks.push(whatItIs);
  } else if (summary) {
    blocks.push(summary);
  }
  if (whoFor.length) {
    blocks.push(`适合：${whoFor.join("、")}。`);
  }
  if (useCases.length) {
    blocks.push(`典型使用场景：${useCases.join("；")}。`);
  }
  return blocks.length ? blocks.join("\n\n").slice(0, 3000) : null;
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

function hasValidKnowledge(knowledge: ProjectKnowledge | null): boolean {
  return Boolean(knowledge?.primaryCategory?.trim());
}

function categoryFromKnowledge(knowledge: ProjectKnowledge | null): string | null {
  const raw = knowledge?.primaryCategory?.trim();
  if (!raw) {
    return null;
  }
  return (KNOWLEDGE_CATEGORIES as readonly string[]).includes(raw)
    ? knowledgeCategoryToProjectSlug(raw as KnowledgeCategory)
    : raw;
}

function publicSources(sources: SourceInput[] | null | undefined): ResolvedProjectSourceItem[] {
  return (sources ?? [])
    .filter((source) => source.visibility !== "internal")
    .map((source) => ({
      id: source.id ?? undefined,
      kind: source.kind,
      url: cleanText(source.url, 1000) ?? "",
      label: cleanText(source.label, 120) ?? undefined,
      title: cleanText(source.title, 200),
      summary: cleanText(source.summary, 500),
      isPrimary: Boolean(source.isPrimary),
    }))
    .filter((source) => Boolean(source.url));
}

function sourceByKind(sources: ResolvedProjectSourceItem[], kinds: string[]): ResolvedProjectSourceItem | undefined {
  const normalizedKinds = new Set(kinds.map((kind) => kind.toUpperCase()));
  return sources.find((source) => source.isPrimary && normalizedKinds.has(source.kind.toUpperCase()))
    ?? sources.find((source) => normalizedKinds.has(source.kind.toUpperCase()));
}

function sourceText(sources: ResolvedProjectSourceItem[]): string | null {
  const source = sources.find((item) => item.isPrimary && (item.summary || item.title))
    ?? sources.find((item) => item.summary || item.title);
  return source?.summary ?? source?.title ?? null;
}

export function resolveProjectInformation(input: ProjectInformationResolverInput): ResolvedProjectInformation {
  const warnings: string[] = [];
  const sources = publicSources(input.sources);
  const official = input.officialInfo ?? null;
  const aiInsight = insightObject(input.aiInsight);
  const knowledge = parseProjectKnowledgeFromRow(input.aiKnowledgeJson);
  const officialSummary = cleanText(official?.summary, 500);
  const officialDescription = cleanText(official?.fullDescription);
  const knowledgeSummary = cleanText(aiInsight.summary, 500) ?? cleanText(input.aiCardSummary, 500);
  const knowledgeDescription = insightDescription(input.aiInsight);
  const sourceFallbackText = sourceText(sources);

  const name = firstText([{ value: input.name, source: "legacy" }]);
  const slug = firstText([{ value: input.slug, source: "system" }]);
  const tagline = firstText([
    { value: officialSummary, source: "official" },
    { value: knowledgeSummary, source: "knowledge" },
    { value: sourceFallbackText, source: "source" },
    { value: input.tagline, source: "legacy" },
  ]);
  const description = firstText([
    { value: officialDescription, source: "official" },
    { value: knowledgeDescription, source: "knowledge" },
    { value: sourceFallbackText, source: "source" },
    { value: input.description, source: "legacy" },
    { value: input.simpleSummary, source: "legacy" },
  ]);
  const knowledgeCategory = categoryFromKnowledge(knowledge);
  const primaryCategory = firstText([
    { value: knowledgeCategory, source: "knowledge" },
    { value: input.primaryCategory, source: "legacy" },
  ]);

  const knowledgeTags = knowledge
    ? knowledgeTagsForProject(knowledge, {
        projectName: input.name,
        description: description.value,
        useCases: asStringArray(aiInsight.useCases, 8),
      })
    : [];
  const legacyTags = Array.isArray(input.tags) ? input.tags.filter((tag) => Boolean(tag?.trim())) : [];
  const tagSource = knowledgeTags.length ? "knowledge" : legacyTags.length ? "legacy" : "empty";
  const tags = knowledgeTags.length ? knowledgeTags : legacyTags;

  const websiteSource = sourceByKind(sources, ["WEBSITE", "OFFICIAL", "DOCS"]);
  const githubSource = sourceByKind(sources, ["GITHUB", "GITEE"]);
  const website = firstText([
    { value: official?.website, source: "official" },
    { value: websiteSource?.url, source: "source" },
    { value: input.websiteUrl, source: "legacy" },
  ]);
  const github = firstText([
    { value: githubSource?.url, source: "source" },
    { value: input.githubUrl, source: "legacy" },
  ]);

  const hasUsableKnowledge =
    input.aiInsightStatus === "success" ||
    hasUsefulObjectContent(input.aiInsight) ||
    hasValidKnowledge(knowledge) ||
    Boolean(cleanText(input.aiCardSummary, 500));

  if (!hasUsableKnowledge) {
    warnings.push("缺少可用 AI 结构化分析 / AI 认知卡内容");
  }
  if (!website.value && !github.value && sources.length === 0) {
    warnings.push("缺少可公开展示的信息来源链接");
  }
  if (!github.value) {
    warnings.push("未绑定 GitHub，已按非 GitHub 项目处理");
  }

  return {
    name: name.value ?? "",
    slug: slug.value ?? "",
    tagline: tagline.value,
    description: description.value,
    primaryCategory: primaryCategory.value,
    tags,
    websiteUrl: website.value,
    githubUrl: github.value,
    sourceList: sources,
    hasUsableKnowledge,
    provenance: {
      name: name.source,
      slug: slug.source,
      tagline: tagline.source,
      description: description.source,
      primaryCategory: primaryCategory.source,
      tags: tagSource,
      websiteUrl: website.source,
      githubUrl: github.source,
    },
    warnings,
  };
}

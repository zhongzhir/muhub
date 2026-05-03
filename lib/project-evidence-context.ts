import type { Prisma, ProjectSourceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_SOURCE_CONTENT_CHARS = 5000;
const MAX_SOURCE_SUMMARY_CHARS = 1200;
const MAX_PROJECT_DESCRIPTION_CHARS = 2200;
const MAX_REFERENCES = 8;
const MAX_PROJECT_SOURCES = 5;

type EvidenceLink = {
  platform: string;
  label: string | null;
  url: string;
  isPrimary: boolean;
};

type EvidenceSource = {
  id: string;
  kind: ProjectSourceKind | string;
  label: string | null;
  title: string | null;
  url: string | null;
  summary: string | null;
  content: string | null;
  isPrimary: boolean;
  createdAt: string | null;
};

type EvidenceReference = {
  title: string | null;
  url: string | null;
  note: string | null;
};

export type ProjectEvidenceContext = {
  version: "v1";
  projectId: string;
  project: {
    name: string;
    slug: string;
    shortDescription: string | null;
    description: string | null;
    primaryCategory: string | null;
    tags: string[];
    websiteUrl: string | null;
    githubUrl: string | null;
  };
  official: {
    summary: string | null;
    fullDescription: string | null;
    useCases: unknown;
    whoFor: unknown;
    website: string | null;
    twitter: string | null;
    discord: string | null;
    contactEmail: string | null;
    teamInfo: unknown;
    businessInfo: unknown;
  } | null;
  links: EvidenceLink[];
  sources: EvidenceSource[];
  discovery: {
    discoverySource: string | null;
    discoverySourceId: string | null;
    discoveredAt: string | null;
    importedFromCandidateId: string | null;
    sourceArticleUrl: string | null;
    primaryProjectUrl: string | null;
    projectPageUrl: string | null;
    sourceNote: string | null;
    references: EvidenceReference[];
  };
  github: {
    url: string | null;
    latestSnapshot: {
      repoFullName: string;
      repoPlatform: string | null;
      repoOwner: string | null;
      repoName: string | null;
      stars: number;
      forks: number;
      watchers: number;
      openIssues: number;
      commitCount7d: number;
      commitCount30d: number;
      contributorsCount: number;
      lastCommitAt: string | null;
      latestReleaseTag: string | null;
      latestReleaseAt: string | null;
      fetchedAt: string;
    } | null;
  };
  website: {
    url: string | null;
    capturedSources: EvidenceSource[];
  };
  gaps: string[];
  promptText: string;
};

function cleanText(value: string | null | undefined, max: number): string | null {
  const text = value?.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function jsonString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const text = JSON.stringify(value);
    return text.length > 3000 ? `${text.slice(0, 2999)}…` : text;
  } catch {
    return null;
  }
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickJsonString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  for (const key of keys) {
    const text = typeof obj[key] === "string" ? obj[key].trim() : "";
    if (text) return text;
  }
  return null;
}

function referencesFromJson(value: unknown): EvidenceReference[] {
  const out: EvidenceReference[] = [];
  for (const item of jsonArray(value)) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const url = typeof obj.url === "string" ? obj.url.trim() : null;
    const title =
      typeof obj.title === "string" ? obj.title.trim()
      : typeof obj.label === "string" ? obj.label.trim()
      : null;
    const note =
      typeof obj.note === "string" ? obj.note.trim()
      : typeof obj.summary === "string" ? obj.summary.trim()
      : null;
    if (url || title || note) {
      out.push({
        title: title || null,
        url: url || null,
        note: cleanText(note, 700),
      });
    }
    if (out.length >= MAX_REFERENCES) break;
  }
  return out;
}

function sourceRank(source: {
  kind: ProjectSourceKind;
  isPrimary: boolean;
  content: string | null;
  summary: string | null;
  createdAt: Date;
}): number {
  let score = 0;
  if (source.isPrimary) score += 100;
  if (source.kind === "WECHAT_ARTICLE") score += 80;
  if (source.content?.trim()) score += 50;
  if (source.summary?.trim()) score += 20;
  if (source.kind === "WEBSITE" || source.kind === "DOCS") score += 12;
  score += Math.min(10, source.createdAt.getTime() / 1_000_000_000_000);
  return score;
}

function formatLinks(links: EvidenceLink[]): string {
  if (!links.length) return "- 暂无结构化外部链接";
  return links
    .map((link) => {
      const bits = [link.platform, link.label, link.isPrimary ? "primary" : null].filter(Boolean).join(" / ");
      return `- ${bits}: ${link.url}`;
    })
    .join("\n");
}

function formatSources(sources: EvidenceSource[]): string {
  if (!sources.length) return "- 暂无 ProjectSource 文本来源";
  return sources
    .map((source, index) => {
      const header = [
        `来源 ${index + 1}`,
        source.kind,
        source.label,
        source.isPrimary ? "primary" : null,
      ].filter(Boolean).join(" / ");
      return [
        `- ${header}`,
        source.title ? `  标题: ${source.title}` : null,
        source.url ? `  URL: ${source.url}` : null,
        source.summary ? `  摘要: ${source.summary}` : null,
        source.content ? `  正文摘录: ${source.content}` : null,
      ].filter(Boolean).join("\n");
    })
    .join("\n");
}

function formatReferences(references: EvidenceReference[]): string {
  if (!references.length) return "- 暂无";
  return references
    .map((ref) => {
      const label = ref.title || ref.url || "参考来源";
      const note = ref.note ? `: ${ref.note}` : "";
      const url = ref.url ? ` (${ref.url})` : "";
      return `- ${label}${url}${note}`;
    })
    .join("\n");
}

function buildPromptText(ctx: Omit<ProjectEvidenceContext, "promptText">): string {
  const officialLines = ctx.official
    ? [
        ctx.official.summary ? `- 官方一句话: ${ctx.official.summary}` : null,
        ctx.official.fullDescription ? `- 官方详细介绍: ${ctx.official.fullDescription}` : null,
        jsonString(ctx.official.whoFor) ? `- 官方适合人群: ${jsonString(ctx.official.whoFor)}` : null,
        jsonString(ctx.official.useCases) ? `- 官方使用场景: ${jsonString(ctx.official.useCases)}` : null,
        ctx.official.website ? `- 官方网站: ${ctx.official.website}` : null,
        ctx.official.contactEmail ? `- 联系邮箱: ${ctx.official.contactEmail}` : null,
      ].filter(Boolean).join("\n")
    : "- 暂无人工认领/官方维护信息";

  const githubLines = [
    ctx.github.url ? `- GitHub URL: ${ctx.github.url}` : "- 未提供 GitHub URL",
    ctx.github.latestSnapshot
      ? `- 最新仓库快照: ${ctx.github.latestSnapshot.repoFullName}, stars=${ctx.github.latestSnapshot.stars}, forks=${ctx.github.latestSnapshot.forks}, commits30d=${ctx.github.latestSnapshot.commitCount30d}, lastCommitAt=${ctx.github.latestSnapshot.lastCommitAt ?? "unknown"}`
      : "- 暂无 GitHub 快照",
  ].join("\n");

  return [
    "Project Evidence Context V1",
    "",
    "1. 人工/官方信息",
    `- 项目: ${ctx.project.name} (${ctx.project.slug})`,
    ctx.project.shortDescription ? `- 一句话: ${ctx.project.shortDescription}` : null,
    ctx.project.description ? `- 项目描述: ${ctx.project.description}` : null,
    ctx.project.primaryCategory ? `- 主分类: ${ctx.project.primaryCategory}` : null,
    ctx.project.tags.length ? `- 标签: ${ctx.project.tags.join(", ")}` : null,
    officialLines,
    "",
    "2. 项目主地址与外部链接",
    ctx.project.websiteUrl ? `- websiteUrl: ${ctx.project.websiteUrl}` : "- 未提供 websiteUrl",
    ctx.project.githubUrl ? `- githubUrl: ${ctx.project.githubUrl}` : "- 未提供 githubUrl",
    formatLinks(ctx.links),
    "",
    "3. 来源文章 / 公众号文章 / 用户采集来源",
    formatSources(ctx.sources),
    "",
    "4. GitHub / 技术来源",
    githubLines,
    "",
    "5. Discovery 元数据",
    ctx.discovery.discoverySource ? `- discoverySource: ${ctx.discovery.discoverySource}` : null,
    ctx.discovery.sourceArticleUrl ? `- sourceArticleUrl: ${ctx.discovery.sourceArticleUrl}` : null,
    ctx.discovery.primaryProjectUrl ? `- primaryProjectUrl: ${ctx.discovery.primaryProjectUrl}` : null,
    ctx.discovery.projectPageUrl ? `- projectPageUrl: ${ctx.discovery.projectPageUrl}` : null,
    ctx.discovery.sourceNote ? `- sourceNote: ${ctx.discovery.sourceNote}` : null,
    formatReferences(ctx.discovery.references),
    "",
    "6. 信息缺口",
    ctx.gaps.length ? ctx.gaps.map((gap) => `- ${gap}`).join("\n") : "- 暂无明显缺口",
  ].filter((x) => x !== null && x !== undefined).join("\n");
}

export async function buildProjectEvidenceContext(projectId: string): Promise<ProjectEvidenceContext | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      officialInfo: true,
      externalLinks: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      sources: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
      githubSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 },
      importedFromCandidate: {
        select: {
          externalUrl: true,
          website: true,
          repoUrl: true,
          docsUrl: true,
          sourceKey: true,
          metadataJson: true,
          referenceSources: true,
          rawPayloadJson: true,
          source: { select: { name: true, key: true, type: true } },
        },
      },
    },
  });
  if (!row) return null;

  const sortedSources = [...row.sources]
    .sort((a, b) => sourceRank(b) - sourceRank(a))
    .slice(0, MAX_PROJECT_SOURCES)
    .map((source) => ({
      id: source.id,
      kind: source.kind,
      label: source.label ?? null,
      title: cleanText(source.title, 300),
      url: source.url || null,
      summary: cleanText(source.summary, MAX_SOURCE_SUMMARY_CHARS),
      content: cleanText(source.content, MAX_SOURCE_CONTENT_CHARS),
      isPrimary: source.isPrimary,
      createdAt: source.createdAt.toISOString(),
    }));

  const externalLinks = row.externalLinks.map((link) => ({
    platform: link.platform,
    label: link.label ?? null,
    url: link.url,
    isPrimary: link.isPrimary,
  }));

  const sourceLinks = row.sources
    .filter((source) => source.url?.trim())
    .map((source) => ({
      platform: source.kind.toLowerCase(),
      label: source.label ?? source.title ?? null,
      url: source.url,
      isPrimary: source.isPrimary,
    }));

  const linkKey = new Set<string>();
  const links: EvidenceLink[] = [];
  for (const link of [...externalLinks, ...sourceLinks]) {
    const key = `${link.platform.toLowerCase()}:${link.url.toLowerCase()}`;
    if (linkKey.has(key)) continue;
    linkKey.add(key);
    links.push(link);
  }

  const candidate = row.importedFromCandidate;
  const metadata = candidate?.metadataJson;
  const rawPayload = candidate?.rawPayloadJson;
  const sourceArticleUrl =
    pickJsonString(metadata, ["sourceArticleUrl", "articleUrl", "sourceUrl"]) ??
    pickJsonString(rawPayload, ["sourceArticleUrl", "articleUrl", "sourceUrl"]) ??
    null;
  const primaryProjectUrl =
    pickJsonString(metadata, ["primaryProjectUrl", "projectUrl", "primaryUrl"]) ??
    candidate?.website ??
    candidate?.repoUrl ??
    null;
  const projectPageUrl =
    pickJsonString(metadata, ["projectPageUrl", "externalUrl"]) ??
    candidate?.externalUrl ??
    null;
  const sourceNote =
    pickJsonString(metadata, ["sourceNote", "note"]) ??
    pickJsonString(rawPayload, ["sourceNote", "note"]) ??
    null;
  const references = [
    ...referencesFromJson(row.referenceSources),
    ...referencesFromJson(candidate?.referenceSources),
  ].slice(0, MAX_REFERENCES);

  const latest = row.githubSnapshots[0] ?? null;
  const gaps: string[] = [];
  if (!row.websiteUrl && !row.officialInfo?.website && !links.some((link) => link.platform.toLowerCase().includes("website"))) {
    gaps.push("缺少官网或明确项目主页");
  }
  if (!row.githubUrl && !links.some((link) => link.platform.toLowerCase().includes("github"))) {
    gaps.push("缺少 GitHub，不应因此降低非技术项目的文本分析可信度");
  }
  if (!sortedSources.some((source) => source.content?.trim())) {
    gaps.push("缺少可直接阅读的来源正文");
  }
  if (!row.officialInfo) {
    gaps.push("缺少认领方/官方人工维护信息");
  }

  const contextWithoutPrompt: Omit<ProjectEvidenceContext, "promptText"> = {
    version: "v1",
    projectId: row.id,
    project: {
      name: row.name,
      slug: row.slug,
      shortDescription: cleanText(row.tagline ?? row.simpleSummary, 500),
      description: cleanText(row.description, MAX_PROJECT_DESCRIPTION_CHARS),
      primaryCategory: row.primaryCategory ?? null,
      tags: row.tags,
      websiteUrl: row.websiteUrl ?? null,
      githubUrl: row.githubUrl ?? null,
    },
    official: row.officialInfo
      ? {
          summary: cleanText(row.officialInfo.summary, 800),
          fullDescription: cleanText(row.officialInfo.fullDescription, 3000),
          useCases: row.officialInfo.useCases,
          whoFor: row.officialInfo.whoFor,
          website: row.officialInfo.website ?? null,
          twitter: row.officialInfo.twitter ?? null,
          discord: row.officialInfo.discord ?? null,
          contactEmail: row.officialInfo.contactEmail ?? null,
          teamInfo: row.officialInfo.teamInfo,
          businessInfo: row.officialInfo.businessInfo,
        }
      : null,
    links,
    sources: sortedSources,
    discovery: {
      discoverySource: row.discoverySource ?? candidate?.source?.name ?? candidate?.source?.key ?? null,
      discoverySourceId: row.discoverySourceId ?? null,
      discoveredAt: row.discoveredAt?.toISOString() ?? null,
      importedFromCandidateId: row.importedFromCandidateId ?? null,
      sourceArticleUrl,
      primaryProjectUrl,
      projectPageUrl,
      sourceNote,
      references,
    },
    github: {
      url: row.githubUrl ?? null,
      latestSnapshot: latest
        ? {
            repoFullName: latest.repoFullName,
            repoPlatform: latest.repoPlatform,
            repoOwner: latest.repoOwner,
            repoName: latest.repoName,
            stars: latest.stars,
            forks: latest.forks,
            watchers: latest.watchers,
            openIssues: latest.openIssues,
            commitCount7d: latest.commitCount7d,
            commitCount30d: latest.commitCount30d,
            contributorsCount: latest.contributorsCount,
            lastCommitAt: latest.lastCommitAt?.toISOString() ?? null,
            latestReleaseTag: latest.latestReleaseTag,
            latestReleaseAt: latest.latestReleaseAt?.toISOString() ?? null,
            fetchedAt: latest.fetchedAt.toISOString(),
          }
        : null,
    },
    website: {
      url: row.websiteUrl ?? row.officialInfo?.website ?? null,
      capturedSources: sortedSources.filter((source) => source.kind === "WEBSITE" || source.kind === "DOCS"),
    },
    gaps,
  };

  return {
    ...contextWithoutPrompt,
    promptText: buildPromptText(contextWithoutPrompt),
  };
}

export type DiscoveryCandidateEvidenceInput = {
  title: string;
  summary: string | null;
  descriptionRaw: string | null;
  website: string | null;
  docsUrl: string | null;
  repoUrl: string | null;
  externalUrl?: string | null;
  externalType?: string | null;
  sourceKey?: string | null;
  metadataJson?: Prisma.JsonValue | null;
  referenceSources?: Prisma.JsonValue | null;
  rawPayloadJson?: Prisma.JsonValue | null;
  enrichmentLinks?: { platform: string; url: string; evidenceText?: string | null }[];
};

export function buildDiscoveryCandidateEvidenceText(input: DiscoveryCandidateEvidenceInput): string {
  const references = formatReferences(referencesFromJson(input.referenceSources));
  const metadataText = jsonString(input.metadataJson);
  const rawText = jsonString(input.rawPayloadJson);
  const links =
    input.enrichmentLinks?.length
      ? input.enrichmentLinks
          .map((link) => `- ${link.platform}: ${link.url}${link.evidenceText ? ` (${cleanText(link.evidenceText, 240)})` : ""}`)
          .join("\n")
      : "- 暂无 enrichment 外链";
  return [
    "Discovery Candidate Evidence Context V1",
    `- title: ${input.title}`,
    input.summary ? `- summary: ${cleanText(input.summary, 1200)}` : null,
    input.descriptionRaw ? `- descriptionRaw: ${cleanText(input.descriptionRaw, 5000)}` : null,
    input.website ? `- website: ${input.website}` : null,
    input.docsUrl ? `- docsUrl: ${input.docsUrl}` : null,
    input.repoUrl ? `- repoUrl: ${input.repoUrl}` : null,
    input.externalUrl ? `- externalUrl: ${input.externalUrl}` : null,
    input.externalType ? `- externalType: ${input.externalType}` : null,
    input.sourceKey ? `- sourceKey: ${input.sourceKey}` : null,
    "参考来源:",
    references,
    "自动补全外链:",
    links,
    metadataText ? `metadataJson: ${metadataText}` : null,
    rawText ? `rawPayloadJson: ${rawText}` : null,
  ].filter(Boolean).join("\n");
}

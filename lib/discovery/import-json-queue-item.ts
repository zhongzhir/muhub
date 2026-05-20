/**
 * 将本地 JSON Discovery 队列项导入为正式 Project（与 Prisma DiscoveryCandidate 并存的最小闭环）。
 */
import type { DiscoveryItem } from "@/agents/discovery/discovery-types";
import { updateDiscoveryAiStatus } from "@/agents/discovery/discovery-store";
import type { Prisma, ProjectSourceKind } from "@prisma/client";
import { parseRepoUrl } from "@/lib/repo-platform";
import { prisma } from "@/lib/prisma";
import { allocateUniqueProjectSlug } from "@/lib/project-allocate-slug";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { inferRepoSourceKind } from "@/lib/project-sources";
import { parseProjectSourceUrl } from "@/lib/project-source-url";
import {
  classifyProjectUrl,
  isProjectPrimaryUrl,
  isSourceArticleUrl,
} from "@/lib/project-url-classifier";
import { isValidProjectSlug, slugifyProjectName } from "@/lib/project-slug";
import { scheduleProjectAiEnrichment } from "@/lib/ai/enrich-project";
import { createProjectActivity } from "@/lib/activity/project-activity-service";
import { CHINESE_INDIE_SOURCE_KEY } from "@/lib/discovery/sources/chinese-independent-developer";
import {
  bestDescriptionFromWebsiteEvidence,
  bestTitleFromWebsiteEvidence,
  fetchWebsiteEvidence,
} from "@/lib/project-url-evidence";

function isChineseIndieDiscoveryItem(item: DiscoveryItem): boolean {
  return stringMeta(item.meta, "sourceKey") === CHINESE_INDIE_SOURCE_KEY;
}

function buildDiscoveryImportSourceCreates(input: {
  item: DiscoveryItem;
  link: ParsedLink;
  articleSource: ArticleSourceInput | null;
  curatedSource: ArticleSourceInput | null;
  websiteEvidence?: Awaited<ReturnType<typeof fetchWebsiteEvidence>> | null;
}): {
  kind: ProjectSourceKind;
  url: string;
  isPrimary: boolean;
  label?: string | null;
  title?: string | null;
  content?: string | null;
  summary?: string | null;
}[] {
  const { item, link, articleSource, curatedSource, websiteEvidence } = input;
  const sourceCreates: {
    kind: ProjectSourceKind;
    url: string;
    isPrimary: boolean;
    label?: string | null;
    title?: string | null;
    content?: string | null;
    summary?: string | null;
  }[] = [];
  const chineseIndie = isChineseIndieDiscoveryItem(item);

  if (chineseIndie && link.websiteUrl) {
    sourceCreates.push({
      kind: "WEBSITE",
      url: link.websiteUrl,
      isPrimary: true,
      title: bestTitleFromWebsiteEvidence(websiteEvidence ?? null) || item.title,
      summary:
        bestDescriptionFromWebsiteEvidence(websiteEvidence ?? null) ||
        item.description?.trim() ||
        null,
      content: websiteEvidence?.textExcerpt ?? null,
    });
    if (link.githubUrl) {
      sourceCreates.push({
        kind: inferRepoSourceKind(link.githubUrl),
        url: link.githubUrl,
        isPrimary: false,
      });
    }
  } else {
    if (link.githubUrl) {
      sourceCreates.push({
        kind: inferRepoSourceKind(link.githubUrl),
        url: link.githubUrl,
        isPrimary: true,
      });
    }
    if (link.primaryRepo?.kind === "GITEE") {
      sourceCreates.push({
        kind: "GITEE",
        url: link.primaryRepo.url,
        isPrimary: true,
      });
    }
    if (link.primaryRepo?.kind === "OTHER") {
      sourceCreates.push({
        kind: "OTHER",
        url: link.primaryRepo.url,
        label: link.primaryRepo.label ?? null,
        isPrimary: true,
      });
    }
    if (link.websiteUrl) {
      sourceCreates.push({
        kind: "WEBSITE",
        url: link.websiteUrl,
        isPrimary: !link.githubUrl && link.primaryRepo?.kind !== "GITEE",
        title: bestTitleFromWebsiteEvidence(websiteEvidence ?? null) || undefined,
        summary: bestDescriptionFromWebsiteEvidence(websiteEvidence ?? null) || undefined,
        content: websiteEvidence?.textExcerpt ?? undefined,
      });
    }
  }

  if (articleSource) {
    sourceCreates.push({
      kind: "WECHAT_ARTICLE",
      url: articleSource.url,
      label: "公众号文章",
      title: articleSource.title,
      content: articleSource.content,
      summary: articleSource.summary,
      isPrimary: false,
    });
  }
  if (curatedSource) {
    const edition = stringMeta(item.meta, "edition");
    sourceCreates.push({
      kind: "WEBSITE",
      url: curatedSource.url,
      label: edition ? `curated_repository · ${edition}` : "curated_repository",
      title: curatedSource.title,
      content: curatedSource.content,
      summary: curatedSource.summary,
      isPrimary: false,
    });
  }
  for (const source of officialSourcesFromMeta(item)) {
    sourceCreates.push(source);
  }
  return sourceCreates;
}

function taglineFromDescription(description: string | null | undefined): string | null {
  if (!description?.trim()) {
    return null;
  }
  const t = description.trim();
  if (t.length <= 200) {
    return t;
  }
  return `${t.slice(0, 197)}…`;
}

type ParsedLink = {
  githubUrl: string | null;
  websiteUrl: string | null;
  primaryRepo: { kind: ProjectSourceKind; url: string; label?: string | null } | null;
  externalLinks: Array<{ platform: string; url: string; label: string; isPrimary: boolean }>;
};

type ArticleSourceInput = {
  title: string;
  content: string;
  summary: string | null;
  url: string;
};

type MetaProjectSourceInput = {
  kind: ProjectSourceKind;
  url: string;
  label: string;
  isPrimary: boolean;
};

function stringMeta(meta: Record<string, unknown> | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function firstHttpUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"'`，。；：！？、（）【】]+/i);
  return match?.[0]?.replace(/[),.;:!?，。；：！？、）】]+$/u, "") ?? null;
}

function sourceArticleUrlFromItem(item: DiscoveryItem): string | null {
  const candidates = [
    stringMeta(item.meta, "sourceArticleUrl"),
    stringMeta(item.meta, "articleUrl"),
    stringMeta(item.meta, "extractedUrl"),
    item.url,
    firstHttpUrlFromText(stringMeta(item.meta, "articleBody")),
  ];
  for (const candidate of candidates) {
    if (candidate && isSourceArticleUrl(candidate)) {
      return candidate;
    }
  }
  return null;
}

function projectUrlFromItem(item: DiscoveryItem): string {
  const candidates = [
    stringMeta(item.meta, "primaryProjectUrl"),
    stringMeta(item.meta, "projectPageUrl"),
    stringMeta(item.meta, "websiteUrl"),
    stringMeta(item.meta, "sourceUrl"),
    item.url,
  ];
  for (const candidate of candidates) {
    if (candidate && isProjectPrimaryUrl(candidate) && !isSourceArticleUrl(candidate)) {
      return candidate;
    }
  }
  return item.url.trim();
}

function articleSourceFromItem(item: DiscoveryItem): ArticleSourceInput | null {
  const content = stringMeta(item.meta, "articleBody");
  if (!content) {
    return null;
  }
  const title =
    stringMeta(item.meta, "articleTitle") ||
    stringMeta(item.meta, "sourceName") ||
    "公众号文章";
  const summary = stringMeta(item.meta, "sourceName") || null;
  const sourceArticleUrl = sourceArticleUrlFromItem(item);
  if (!sourceArticleUrl) {
    return null;
  }
  return {
    title,
    content,
    summary,
    url: sourceArticleUrl,
  };
}

function curatedSourceFromItem(item: DiscoveryItem): ArticleSourceInput | null {
  if (stringMeta(item.meta, "sourceKey") !== "chinese-independent-developer") {
    return null;
  }
  const content = stringMeta(item.meta, "originalMarkdown");
  if (!content) {
    return null;
  }
  const developerName = stringMeta(item.meta, "developerName");
  return {
    title: "中国独立开发者项目列表",
    content,
    summary: item.description?.trim() || developerName || null,
    url: stringMeta(item.meta, "sourceArticleUrl") || stringMeta(item.meta, "sourceRepo") || item.url,
  };
}

function officialSourcesFromMeta(item: DiscoveryItem): MetaProjectSourceInput[] {
  const meta = item.meta && typeof item.meta === "object" ? (item.meta as Record<string, unknown>) : undefined;
  const out: MetaProjectSourceInput[] = [];
  const push = (kind: ProjectSourceKind, key: string, label: string, isPrimary = false) => {
    const url = stringMeta(meta, key);
    if (!url) return;
    out.push({ kind, url, label, isPrimary });
  };

  const wechatAccount = stringMeta(meta, "wechatAccount");
  if (wechatAccount) {
    out.push({
      kind: "WECHAT",
      url: `wechat://account/${encodeURIComponent(wechatAccount)}`,
      label: wechatAccount,
      isPrimary: false,
    });
  }
  push("OTHER", "weiboUrl", "微博", false);
  push("DOUYIN", "douyinUrl", "抖音", false);
  push("OTHER", "appStoreUrl", "App Store", false);
  push("OTHER", "playStoreUrl", "Google Play", false);

  const seen = new Set<string>();
  return out.filter((source) => {
    const key = `${source.kind}:${source.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function ensureCuratedListProjectSource(
  tx: Prisma.TransactionClient,
  projectId: string,
  curated: ArticleSourceInput | null,
  item: DiscoveryItem,
): Promise<void> {
  if (!curated) {
    return;
  }
  const edition = stringMeta(item.meta, "edition");
  const exists = await tx.projectSource.findFirst({
    where: {
      projectId,
      kind: "WEBSITE",
      url: curated.url,
      title: curated.title,
    },
    select: { id: true },
  });
  if (exists) {
    return;
  }
  await tx.projectSource.create({
    data: {
      projectId,
      kind: "WEBSITE",
      url: curated.url,
      label: edition ? `curated_repository · ${edition}` : "curated_repository",
      title: curated.title,
      content: curated.content,
      summary: curated.summary,
      isPrimary: false,
    },
  });
}

async function ensureArticleProjectSource(
  tx: Prisma.TransactionClient,
  projectId: string,
  article: ArticleSourceInput | null,
): Promise<void> {
  if (!article) {
    return;
  }
  const exists = await tx.projectSource.findFirst({
    where: {
      projectId,
      kind: "WECHAT_ARTICLE",
      url: article.url,
    },
    select: { id: true },
  });
  if (exists) {
    return;
  }
  await tx.projectSource.create({
    data: {
      projectId,
      kind: "WECHAT_ARTICLE",
      url: article.url,
      label: "公众号文章",
      title: article.title,
      content: article.content,
      summary: article.summary,
      isPrimary: false,
    },
  });
}

function parseItemLink(item: DiscoveryItem): ParsedLink {
  const raw = projectUrlFromItem(item);
  if (!raw) {
    throw new Error("条目缺少有效 URL");
  }
  // 通用项目（manual-general）无需 URL，直接返回空链接
  if (!raw.startsWith("http")) {
    // 尝试从 meta 取 websiteUrl / referenceUrl 作为站点
    const ws = (item.meta && typeof item.meta === "object" && "websiteUrl" in item.meta && typeof (item.meta as Record<string,unknown>).websiteUrl === "string")
      ? ((item.meta as Record<string,unknown>).websiteUrl as string).trim()
      : null;
    return {
      githubUrl: null,
      websiteUrl: ws || null,
      primaryRepo: null,
      externalLinks: ws ? [{ platform: "website", url: ws, label: "官方网站", isPrimary: true }] : [],
    };
  }
  if (isSourceArticleUrl(raw)) {
    throw new Error("条目缺少项目主页或平台项目页链接，不能把来源文章当作项目地址导入。");
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("条目 URL 格式无效");
  }
  const host = u.hostname.toLowerCase();
  const parsedRepo = parseRepoUrl(raw);
  const parsedSource = parseProjectSourceUrl(raw);
  const classified = classifyProjectUrl(raw);

  if (parsedRepo?.platform === "github" || host === "github.com" || host.endsWith(".github.com")) {
    const githubUrl = normalizeGithubRepoUrl(raw);
    return {
      githubUrl,
      websiteUrl: null,
      primaryRepo: { kind: "GITHUB", url: githubUrl },
      externalLinks: [],
    };
  }

  if (parsedRepo?.platform === "gitee") {
    const url = normalizeGithubRepoUrl(raw);
    return {
      githubUrl: null,
      websiteUrl: null,
      primaryRepo: { kind: "GITEE", url },
      externalLinks: [],
    };
  }

  if (parsedSource?.type === "GITCC") {
    return {
      githubUrl: null,
      websiteUrl: parsedSource.url,
      primaryRepo: { kind: "OTHER", url: parsedSource.url, label: "GitCC" },
      externalLinks: [
        { platform: "gitcc", url: parsedSource.url, label: "GitCC 项目页", isPrimary: true },
      ],
    };
  }

  if (classified?.role === "platform_project_page") {
    return {
      githubUrl: null,
      websiteUrl: classified.url,
      primaryRepo: { kind: "OTHER", url: classified.url, label: classified.label },
      externalLinks: [
        {
          platform: classified.platform,
          url: classified.url,
          label: classified.label,
          isPrimary: true,
        },
      ],
    };
  }

  return {
    githubUrl: null,
    websiteUrl: u.href,
    primaryRepo: null,
    externalLinks: [],
  };
}

async function createExternalLinks(
  tx: Prisma.TransactionClient,
  projectId: string,
  links: Array<{ platform: string; url: string; label: string; isPrimary: boolean }>,
): Promise<void> {
  const seen = new Set<string>();
  for (const link of links) {
    const url = link.url.trim();
    if (!url) {
      continue;
    }
    const key = `${link.platform}:${url.toLowerCase()}`;
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
        platform: link.platform,
        url,
        label: link.label,
        isPrimary: link.isPrimary,
        source: "discovery-json-import",
      },
    });
  }
}

async function findExistingProject(
  item: DiscoveryItem,
  link: ParsedLink,
): Promise<{ id: string; slug: string; name: string } | null> {
  const title = item.title.trim();
  const baseSlug = slugifyProjectName(title);
  const validBase = baseSlug && isValidProjectSlug(baseSlug) ? baseSlug : null;

  if (item.projectSlug?.trim()) {
    const byHint = await prisma.project.findFirst({
      where: { slug: item.projectSlug.trim(), deletedAt: null },
      select: { id: true, slug: true, name: true },
    });
    if (byHint) {
      return byHint;
    }
  }

  if (link.githubUrl) {
    const byGh = await prisma.project.findFirst({
      where: { deletedAt: null, githubUrl: link.githubUrl },
      select: { id: true, slug: true, name: true },
    });
    if (byGh) {
      return byGh;
    }
  }

  if (link.websiteUrl) {
    const byWeb = await prisma.project.findFirst({
      where: { deletedAt: null, websiteUrl: link.websiteUrl },
      select: { id: true, slug: true, name: true },
    });
    if (byWeb) {
      return byWeb;
    }
  }

  if (link.primaryRepo) {
    const bySource = await prisma.project.findFirst({
      where: {
        deletedAt: null,
        sources: { some: { kind: link.primaryRepo.kind, url: link.primaryRepo.url } },
      },
      select: { id: true, slug: true, name: true },
    });
    if (bySource) {
      return bySource;
    }
  }

  if (validBase) {
    const bySlug = await prisma.project.findFirst({
      where: { deletedAt: null, slug: validBase },
      select: { id: true, slug: true, name: true },
    });
    if (bySlug) {
      return bySlug;
    }
  }

  return null;
}

/**
 * 将一条 JSON 队列项写入 Project 表（若已存在同一 GitHub / 官网 / slug，则仅返回既有 slug，不重复创建）。
 */
export async function importJsonDiscoveryItem(
  item: DiscoveryItem,
  options?: { scheduleAiEnrichment?: boolean },
): Promise<{
  slug: string;
  projectId: string;
  projectName: string;
  created: boolean;
  duplicated: boolean;
}> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("未配置 DATABASE_URL，无法导入项目。");
  }

  if (item.status === "rejected") {
    throw new Error('已拒绝的条目请先使用 "Mark new" 或 "Reviewed" 后再导入。');
  }

  const name = item.title.trim();
  if (!name) {
    throw new Error("条目标题为空，无法导入。");
  }

  const link = parseItemLink(item);
  const articleSource = articleSourceFromItem(item);
  const curatedSource = curatedSourceFromItem(item);

  if (item.status === "imported" && item.projectSlug?.trim()) {
    const exists = await prisma.project.findFirst({
      where: { slug: item.projectSlug.trim(), deletedAt: null },
      select: { slug: true },
    });
    if (exists) {
      const p = await prisma.project.findFirst({
        where: { slug: exists.slug, deletedAt: null },
        select: { id: true, slug: true, name: true },
      });
      if (!p) {
        throw new Error("项目状态异常，请稍后重试");
      }
      return { slug: p.slug, projectId: p.id, projectName: p.name, created: false, duplicated: true };
    }
  }

  const existing = await findExistingProject(item, link);
  if (existing) {
    await prisma.$transaction(async (tx) => {
      if (link.websiteUrl) {
        await tx.project.updateMany({
          where: {
            id: existing.id,
            OR: [{ websiteUrl: null }, { websiteUrl: "" }],
          },
          data: { websiteUrl: link.websiteUrl },
        });
      }
      await ensureArticleProjectSource(tx, existing.id, articleSource);
      await ensureCuratedListProjectSource(tx, existing.id, curatedSource, item);
      for (const source of officialSourcesFromMeta(item)) {
        const exists = await tx.projectSource.findFirst({
          where: { projectId: existing.id, url: source.url },
          select: { id: true },
        });
        if (!exists) {
          await tx.projectSource.create({
            data: {
              projectId: existing.id,
              kind: source.kind,
              url: source.url,
              label: source.label,
              isPrimary: source.isPrimary,
            },
          });
        }
      }
      await createExternalLinks(tx, existing.id, link.externalLinks);
    });
    return {
      slug: existing.slug,
      projectId: existing.id,
      projectName: existing.name,
      created: false,
      duplicated: true,
    };
  }

  const description = item.description?.trim() || null;
  const tagline = taglineFromDescription(description);

  const slug = await allocateUniqueProjectSlug(name);

  const websiteEvidence = link.websiteUrl
    ? await fetchWebsiteEvidence(link.websiteUrl).catch(() => null)
    : null;
  const sourceCreates = buildDiscoveryImportSourceCreates({
    item,
    link,
    articleSource,
    curatedSource,
    websiteEvidence,
  });

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name,
        slug,
        tagline,
        description,
        githubUrl: link.githubUrl,
        websiteUrl: link.websiteUrl,
        tags: [],
        sourceType: "discovery-json-queue",
        status: "DRAFT",
        isPublic: false,
        visibilityStatus: "DRAFT",
        discoverySource: item.sourceType,
        discoverySourceId: item.id,
        discoveredAt: new Date(item.createdAt),
        sources: sourceCreates.length
          ? {
              create: sourceCreates,
            }
          : undefined,
      },
      select: { id: true, slug: true },
    });
    await createExternalLinks(tx, created.id, link.externalLinks);
    return created;
  });

  await createProjectActivity({
    projectId: project.id,
    type: "project_imported",
    title: "项目已收录到 MUHUB 项目库",
    summary: "来自项目发现队列的候选线索，已完成首次建档。",
    sourceType: "discovery_import",
    sourceUrl: item.url,
    occurredAt: new Date(),
    dedupeKey: `project_imported:${project.id}`,
    metadataJson: {
      discoveryItemId: item.id,
      discoverySourceType: item.sourceType,
    },
  });

  try {
    if (options?.scheduleAiEnrichment !== false) {
      scheduleProjectAiEnrichment(project.slug);
      await updateDiscoveryAiStatus(item.id, "scheduled");
      console.log(`[Discovery] AI enrichment scheduled for project: ${project.slug} (id=${project.id})`);
    }
  } catch (e) {
    console.error("[Discovery] AI enrichment schedule failed", e);
  }

  return {
    slug: project.slug,
    projectId: project.id,
    projectName: name,
    created: true,
    duplicated: false,
  };
}

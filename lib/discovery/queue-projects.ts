import { appendDiscoveryItem } from "@/agents/discovery/discovery-store";
import type { DiscoveryItem } from "@/agents/discovery/discovery-types";
import {
  completeOfficialSourcesLightly,
  type OfficialSourceCompletion,
} from "@/lib/discovery/article-extraction";
import { importJsonDiscoveryItem } from "@/lib/discovery/import-json-queue-item";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { prisma } from "@/lib/prisma";
import { slugifyProjectName } from "@/lib/project-slug";
import {
  extractProjectSourceUrlsFromText,
  parseProjectSourceUrl,
} from "@/lib/project-source-url";
import { isSourceArticleUrl } from "@/lib/project-url-classifier";
import type { ChineseIndieCandidateInput } from "@/lib/discovery/sources/chinese-independent-developer";
import {
  CHINESE_INDIE_SOURCE_KEY,
} from "@/lib/discovery/sources/chinese-independent-developer";

export type ExistingProjectHit = {
  id: string;
  slug: string;
  name: string;
  reason: "githubUrl" | "websiteUrl" | "slug" | "name";
};

export type FetchGithubRepoForQueue = (
  owner: string,
  repo: string,
) => Promise<{
  name: string;
  description: string | null;
  homepage: string | null;
  stargazers_count: number;
  language: string | null;
}>;

export type ManualGithubQueueInput = {
  githubUrl: string;
  websiteUrl?: string;
  note?: string;
  title: string;
  summary?: string | null;
  owner?: string;
  repo?: string;
  language?: string | null;
  stargazersCount?: number;
};

export type GeneralProjectQueueInput = {
  title: string;
  summary?: string | null;
  websiteUrl?: string | null;
  referenceUrl?: string | null;
  category?: string | null;
  note?: string;
  wechatAccount?: string | null;
  weiboUrl?: string | null;
  douyinUrl?: string | null;
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
  officialSourceCompletion?: OfficialSourceCompletion[];
};

export type GeneralProjectQueueValidation =
  | {
      ok: true;
      title: string;
      websiteUrl: string | null;
      referenceUrl: string | null;
      wechatAccount: string | null;
      weiboUrl: string | null;
      douyinUrl: string | null;
      appStoreUrl: string | null;
      playStoreUrl: string | null;
      duplicate: ExistingProjectHit | null;
    }
  | { ok: false; error: "empty_title" | "missing_official_source" };

export function extractProjectSourceUrlsFromArticleText(articleBody: string): string[] {
  return extractProjectSourceUrlsFromText(articleBody).map((item) => item.source.url);
}

export function firstSourceArticleUrlFromText(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s<>"'`，。；：！？、（）【】]+/gi) ?? [];
  for (const match of matches) {
    const url = match.replace(/[),.;:!?，。；：！？、）】]+$/u, "");
    if (isSourceArticleUrl(url)) {
      return url;
    }
  }
  return null;
}

export function createManualDiscoveryItem(input: {
  sourceType: "GITHUB" | "GITCC";
  sourceUrl: string;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  title: string;
  summary?: string | null;
  note?: string | null;
  language?: string | null;
  stars?: number;
  owner?: string;
  repo?: string;
}): DiscoveryItem {
  const now = new Date().toISOString();
  const sourceLabel = input.sourceType === "GITHUB" ? "GitHub" : "GitCC";
  return {
    id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: "manual",
    title: input.title.trim(),
    url: input.sourceUrl,
    description: input.summary?.trim() || undefined,
    status: "new",
    createdAt: now,
    meta: {
      source: input.sourceType === "GITHUB" ? "manual-github" : "manual-gitcc",
      sourceKey: input.sourceType === "GITHUB" ? "manual-github" : "manual-gitcc",
      sourceType: input.sourceType,
      sourceLabel,
      sourceUrl: input.sourceUrl,
      githubUrl: input.githubUrl ?? null,
      websiteUrl: input.websiteUrl?.trim() || null,
      note: input.note?.trim() || null,
      language: input.language?.trim() || null,
      stars: input.stars ?? 0,
      owner: input.owner ?? null,
      repo: input.repo ?? null,
    },
  };
}

export async function findExistingProjectByPriority(input: {
  githubUrl?: string | null;
  source?: { kind: "GITHUB" | "OTHER"; url: string; label?: string | null } | null;
  websiteUrl?: string | null;
  title: string;
  repo: string;
}): Promise<ExistingProjectHit | null> {
  const githubUrl = input.githubUrl?.trim() || null;
  if (githubUrl) {
    const byGithub = await prisma.project.findFirst({
      where: { deletedAt: null, githubUrl },
      select: { id: true, slug: true, name: true },
    });
    if (byGithub) {
      return { ...byGithub, reason: "githubUrl" };
    }
  }

  if (input.source?.url) {
    const bySource = await prisma.project.findFirst({
      where: {
        deletedAt: null,
        sources: { some: { kind: input.source.kind, url: input.source.url } },
      },
      select: { id: true, slug: true, name: true },
    });
    if (bySource) {
      return { ...bySource, reason: "githubUrl" };
    }
  }

  const websiteUrl = input.websiteUrl?.trim() || null;
  if (websiteUrl) {
    const byWebsite = await prisma.project.findFirst({
      where: { deletedAt: null, websiteUrl },
      select: { id: true, slug: true, name: true },
    });
    if (byWebsite) {
      return { ...byWebsite, reason: "websiteUrl" };
    }
  }

  const candidateSlug = slugifyProjectName(input.title) || slugifyProjectName(input.repo);
  if (candidateSlug) {
    const bySlug = await prisma.project.findFirst({
      where: { deletedAt: null, slug: candidateSlug },
      select: { id: true, slug: true, name: true },
    });
    if (bySlug) {
      return { ...bySlug, reason: "slug" };
    }
  }

  const byName = await prisma.project.findFirst({
    where: { deletedAt: null, name: input.title.trim() },
    select: { id: true, slug: true, name: true },
  });
  if (byName) {
    return { ...byName, reason: "name" };
  }

  return null;
}

function resolveManualSource(input: ManualGithubQueueInput) {
  const githubUrlRaw = input.githubUrl?.trim() || "";
  const source = parseProjectSourceUrl(githubUrlRaw);
  if (!source || (source.type !== "GITHUB" && source.type !== "GITCC")) {
    return null;
  }
  const githubUrl = source.type === "GITHUB" ? normalizeGithubRepoUrl(source.url) : null;
  const title =
    input.title?.trim() ||
    (source.type === "GITHUB"
      ? source.repo
      : source.url.replace(/\/+$/g, "").split("/").filter(Boolean).pop() || "GitCC 项目");

  return {
    source,
    githubUrl,
    title,
    websiteUrl: input.websiteUrl?.trim() || (source.type === "GITCC" ? source.url : null),
  };
}

export async function validateManualGithubProjectInput(input: ManualGithubQueueInput): Promise<
  | {
      ok: true;
      source: NonNullable<ReturnType<typeof resolveManualSource>>["source"];
      githubUrl: string | null;
      title: string;
      websiteUrl: string | null;
      duplicate: ExistingProjectHit | null;
    }
  | { ok: false; error: "invalid_source" }
> {
  const resolved = resolveManualSource(input);
  if (!resolved) {
    return { ok: false, error: "invalid_source" };
  }
  const duplicate = await findExistingProjectByPriority({
    githubUrl: resolved.githubUrl,
    source:
      resolved.source.type === "GITHUB"
        ? { kind: "GITHUB", url: resolved.githubUrl!, label: "GitHub" }
        : { kind: "OTHER", url: resolved.source.url, label: "GitCC" },
    websiteUrl: resolved.websiteUrl,
    title: resolved.title,
    repo: resolved.source.repo ?? resolved.title,
  });

  return { ok: true, ...resolved, duplicate };
}

export async function addManualGithubToQueue(input: ManualGithubQueueInput): Promise<
  | { ok: true; duplicate: boolean }
  | { ok: false; error: "invalid_source"; duplicate?: never }
  | { ok: false; error: "existing_project"; duplicate: ExistingProjectHit }
> {
  const validation = await validateManualGithubProjectInput(input);
  if (!validation.ok) {
    return validation;
  }
  if (validation.duplicate) {
    return { ok: false, error: "existing_project", duplicate: validation.duplicate };
  }

  const item = createManualDiscoveryItem({
    sourceType: validation.source.type === "GITHUB" ? "GITHUB" : "GITCC",
    sourceUrl: validation.githubUrl ?? validation.source.url,
    githubUrl: validation.githubUrl,
    websiteUrl: input.websiteUrl || (validation.source.type === "GITCC" ? validation.source.url : undefined),
    title: validation.title,
    summary: input.summary,
    note: input.note,
    language: input.language ?? null,
    stars: input.stargazersCount ?? 0,
    owner: input.owner || validation.source.owner || undefined,
    repo: input.repo || validation.source.repo || undefined,
  });
  const created = await appendDiscoveryItem(item);
  return { ok: true, duplicate: created.duplicate };
}

export async function importManualGithubProject(input: ManualGithubQueueInput): Promise<
  | { ok: true; slug: string; duplicated: boolean; created?: boolean; existing?: boolean }
  | { ok: false; error: "invalid_source" }
> {
  const validation = await validateManualGithubProjectInput(input);
  if (!validation.ok) {
    return validation;
  }
  if (validation.duplicate) {
    return {
      ok: true,
      slug: validation.duplicate.slug,
      duplicated: true,
      existing: true,
    };
  }

  const item = createManualDiscoveryItem({
    sourceType: validation.source.type === "GITHUB" ? "GITHUB" : "GITCC",
    sourceUrl: validation.githubUrl ?? validation.source.url,
    githubUrl: validation.githubUrl,
    websiteUrl: input.websiteUrl || (validation.source.type === "GITCC" ? validation.source.url : undefined),
    title: validation.title,
    summary: input.summary,
    note: input.note,
    language: input.language ?? null,
    stars: input.stargazersCount ?? 0,
    owner: input.owner || validation.source.owner || undefined,
    repo: input.repo || validation.source.repo || undefined,
  });
  const result = await importJsonDiscoveryItem(item);
  return {
    ok: true,
    slug: result.slug,
    duplicated: result.duplicated,
    created: result.created,
  };
}

export async function validateGeneralProjectInput(
  input: GeneralProjectQueueInput,
): Promise<GeneralProjectQueueValidation> {
  const title = input.title?.trim();
  if (!title) {
    return { ok: false, error: "empty_title" };
  }

  const websiteUrl = input.websiteUrl?.trim() || null;
  const referenceUrl = input.referenceUrl?.trim() || null;
  const wechatAccount = input.wechatAccount?.trim() || null;
  const weiboUrl = input.weiboUrl?.trim() || null;
  const douyinUrl = input.douyinUrl?.trim() || null;
  const appStoreUrl = input.appStoreUrl?.trim() || null;
  const playStoreUrl = input.playStoreUrl?.trim() || null;
  const isProductHuntRef = /producthunt\.com\/(products|posts)\//i.test(referenceUrl ?? "");
  const hasOfficialSource = !!(
    websiteUrl ||
    wechatAccount ||
    weiboUrl ||
    douyinUrl ||
    appStoreUrl ||
    playStoreUrl ||
    isProductHuntRef
  );
  if (!hasOfficialSource) {
    return { ok: false, error: "missing_official_source" };
  }

  const duplicate = await findExistingProjectByPriority({
    githubUrl: null,
    source: null,
    websiteUrl: websiteUrl || referenceUrl || null,
    title,
    repo: title,
  });

  return {
    ok: true,
    title,
    websiteUrl,
    referenceUrl,
    wechatAccount,
    weiboUrl,
    douyinUrl,
    appStoreUrl,
    playStoreUrl,
    duplicate,
  };
}

function createGeneralDiscoveryItem(input: GeneralProjectQueueInput, validation: Extract<GeneralProjectQueueValidation, { ok: true }>): DiscoveryItem {
  const now = new Date().toISOString();
  return {
    id: `manual-general-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: "manual",
    title: validation.title,
    url: validation.websiteUrl || `manual-general-${Date.now().toString(36)}`,
    description: input.summary?.trim() || undefined,
    status: "new",
    createdAt: now,
    meta: {
      source: "manual-general",
      sourceKey: "manual-general",
      sourceType: "GENERAL",
      sourceLabel: "手动添加",
      sourceUrl: validation.websiteUrl || null,
      githubUrl: null,
      websiteUrl: validation.websiteUrl,
      referenceUrl: validation.referenceUrl,
      note: input.note?.trim() || null,
      category: input.category?.trim() || null,
      language: null,
      stars: 0,
      owner: null,
      repo: null,
      wechatAccount: validation.wechatAccount,
      weiboUrl: validation.weiboUrl,
      douyinUrl: validation.douyinUrl,
      appStoreUrl: validation.appStoreUrl,
      playStoreUrl: validation.playStoreUrl,
      officialSourceCompletion: input.officialSourceCompletion ?? [],
    },
  };
}

export async function addGeneralProjectToQueue(input: GeneralProjectQueueInput): Promise<
  | { ok: true; duplicate: boolean }
  | { ok: false; error: "empty_title" | "missing_official_source" }
  | { ok: false; error: "existing_project"; duplicate: ExistingProjectHit }
> {
  const validation = await validateGeneralProjectInput(input);
  if (!validation.ok) {
    return validation;
  }
  if (validation.duplicate) {
    return { ok: false, error: "existing_project", duplicate: validation.duplicate };
  }

  const created = await appendDiscoveryItem(createGeneralDiscoveryItem(input, validation));
  return { ok: true, duplicate: created.duplicate };
}

export async function importGeneralProject(input: GeneralProjectQueueInput): Promise<
  | { ok: true; slug: string; duplicated: boolean; created?: boolean; existing?: boolean }
  | { ok: false; error: "empty_title" | "missing_official_source" }
> {
  const validation = await validateGeneralProjectInput(input);
  if (!validation.ok) {
    return validation;
  }
  if (validation.duplicate) {
    return {
      ok: true,
      slug: validation.duplicate.slug,
      duplicated: true,
      existing: true,
    };
  }

  const result = await importJsonDiscoveryItem(createGeneralDiscoveryItem(input, validation));
  return {
    ok: true,
    slug: result.slug,
    duplicated: result.duplicated,
    created: result.created,
  };
}

function titleFromProductHuntSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function bulkAddGithubProjectsToQueue(input: {
  sourceName?: string;
  articleTitle?: string;
  articleBody: string;
  sourceArticleUrl?: string | null;
  selectedGithubUrls: string[];
  fetchGithubRepo: FetchGithubRepoForQueue;
}): Promise<{ success: number; duplicate: number; failed: number }> {
  const body = input.articleBody.trim();
  const allSelected = Array.from(
    new Set((input.selectedGithubUrls ?? []).map((item) => item.trim()).filter(Boolean)),
  );
  const generalSelected = allSelected.filter((item) => item.startsWith("general:"));
  const urlSelected = allSelected.filter((item) => !item.startsWith("general:"));
  const allowed = new Set(extractProjectSourceUrlsFromArticleText(body));
  const validUrlSelected = urlSelected.filter((item) => allowed.has(item));
  const selected = [...validUrlSelected, ...generalSelected];

  let success = 0;
  let duplicate = 0;
  let failed = 0;
  const sourceName = input.sourceName?.trim() || null;
  const articleTitle = input.articleTitle?.trim() || null;
  const sourceArticleUrl = input.sourceArticleUrl?.trim() || firstSourceArticleUrlFromText(body);

  for (const sourceUrl of selected) {
    if (sourceUrl.startsWith("general:")) {
      const projectName = sourceUrl.slice("general:".length).trim();
      if (!projectName) {
        failed += 1;
        continue;
      }
      try {
        const existing = await findExistingProjectByPriority({
          githubUrl: null,
          source: null,
          websiteUrl: null,
          title: projectName,
          repo: projectName,
        });
        if (existing) {
          duplicate += 1;
          continue;
        }
        const officialSourceCompletion = await completeOfficialSourcesLightly({
          title: projectName,
          summary: null,
          referenceText: body,
          appStoreUrl: null,
          playStoreUrl: null,
        });
        const appStoreUrl =
          officialSourceCompletion.find((item) => item.kind === "APP_STORE")?.url ?? null;
        const playStoreUrl =
          officialSourceCompletion.find((item) => item.kind === "GOOGLE_PLAY")?.url ?? null;
        const now = new Date().toISOString();
        const item: DiscoveryItem = {
          id: `manual-general-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          sourceType: "manual",
          title: projectName,
          url: `manual-general-${Date.now().toString(36)}`,
          description: undefined,
          status: "new",
          createdAt: now,
          meta: {
            source: "wechat-article",
            sourceKey: "manual-general",
            sourceType: "GENERAL",
            sourceLabel: "手动添加",
            sourceUrl: null,
            githubUrl: null,
            websiteUrl: null,
            referenceUrl: sourceArticleUrl,
            note: null,
            category: null,
            language: null,
            stars: 0,
            owner: null,
            repo: null,
            sourceName,
            articleTitle,
            articleBody: body,
            sourceArticleUrl,
            extractedFrom: "ai_article_extraction",
            appStoreUrl,
            playStoreUrl,
            officialSourceCompletion,
          },
        };
        const appended = await appendDiscoveryItem(item);
        if (appended.duplicate) {
          duplicate += 1;
        } else {
          success += 1;
        }
      } catch {
        failed += 1;
      }
      continue;
    }

    const source = parseProjectSourceUrl(sourceUrl);
    if (!source || (source.type !== "GITHUB" && source.type !== "GITCC" && source.type !== "PRODUCTHUNT")) {
      failed += 1;
      continue;
    }

    try {
      if (source.type === "GITCC") {
        const projectName =
          source.url.replace(/\/+$/g, "").split("/").filter(Boolean).pop() || "GitCC 项目";
        const existing = await findExistingProjectByPriority({
          githubUrl: null,
          source: { kind: "OTHER", url: source.url, label: "GitCC" },
          websiteUrl: source.url,
          title: projectName,
          repo: projectName,
        });
        if (existing) {
          duplicate += 1;
          continue;
        }
        const item = createManualDiscoveryItem({
          sourceType: "GITCC",
          sourceUrl: source.url,
          githubUrl: null,
          websiteUrl: source.url,
          title: projectName,
          summary: "已识别为 GitCC 来源，可导入为外部项目。",
          language: null,
          stars: 0,
        });
        item.meta = {
          ...(item.meta ?? {}),
          source: "wechat-article",
          sourceType: "wechat",
          sourceName,
          articleTitle,
          articleBody: body,
          sourceArticleUrl,
          extractedFrom: "article_text",
          projectSourceType: "GITCC",
          primaryProjectUrl: source.url,
          projectPageUrl: source.url,
          websiteUrl: source.url,
          externalLinks: [
            { platform: "gitcc", label: "GitCC 项目页", url: source.url, primary: true },
          ],
          sourceUrl: source.url,
        };
        const appended = await appendDiscoveryItem(item);
        if (appended.duplicate) {
          duplicate += 1;
        } else {
          success += 1;
        }
        continue;
      }

      if (source.type === "PRODUCTHUNT") {
        const slug = source.slug || source.url.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "product";
        const projectName = titleFromProductHuntSlug(slug);
        const existing = await findExistingProjectByPriority({
          githubUrl: null,
          source: { kind: "OTHER", url: source.url, label: "Product Hunt" },
          websiteUrl: source.url,
          title: projectName,
          repo: projectName,
        });
        if (existing) {
          duplicate += 1;
          continue;
        }
        const now = new Date().toISOString();
        const item: DiscoveryItem = {
          id: `manual-ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          sourceType: "manual",
          title: projectName,
          url: source.url,
          description: undefined,
          status: "new",
          createdAt: now,
          meta: {
            source: "wechat-article",
            sourceKey: "manual-producthunt",
            sourceType: "PRODUCTHUNT",
            sourceLabel: "Product Hunt",
            sourceUrl: source.url,
            githubUrl: null,
            websiteUrl: source.url,
            referenceUrl: sourceArticleUrl,
            note: null,
            category: null,
            language: null,
            stars: 0,
            owner: null,
            repo: null,
            sourceName,
            articleTitle,
            articleBody: body,
            sourceArticleUrl,
            extractedFrom: "article_text",
            primaryProjectUrl: source.url,
            projectPageUrl: source.url,
            externalLinks: [
              { platform: "producthunt", label: "Product Hunt", url: source.url, primary: true },
            ],
          },
        };
        const appended = await appendDiscoveryItem(item);
        if (appended.duplicate) {
          duplicate += 1;
        } else {
          success += 1;
        }
        continue;
      }

      if (source.type !== "GITHUB" || !source.owner || !source.repo) {
        failed += 1;
        continue;
      }

      const githubUrl = normalizeGithubRepoUrl(source.url);
      const repoData = await input.fetchGithubRepo(source.owner, source.repo);
      const existing = await findExistingProjectByPriority({
        githubUrl,
        source: { kind: "GITHUB", url: githubUrl, label: "GitHub" },
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        repo: source.repo,
      });
      if (existing) {
        duplicate += 1;
        continue;
      }
      const item = createManualDiscoveryItem({
        sourceType: "GITHUB",
        sourceUrl: githubUrl,
        githubUrl,
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        summary: repoData.description,
        language: repoData.language,
        stars: repoData.stargazers_count,
        owner: source.owner,
        repo: source.repo,
      });
      item.meta = {
        ...(item.meta ?? {}),
        source: "wechat-article",
        sourceType: "wechat",
        sourceName,
        articleTitle,
        articleBody: body,
        sourceArticleUrl,
        extractedFrom: "article_text",
        githubUrl,
        primaryProjectUrl: githubUrl,
        sourceUrl: githubUrl,
      };
      const appended = await appendDiscoveryItem(item);
      if (appended.duplicate) {
        duplicate += 1;
      } else {
        success += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { success, duplicate, failed };
}

export function countBulkQueueSelection(input: {
  articleBody: string;
  selectedGithubUrls: string[];
}): number {
  const allSelected = Array.from(
    new Set((input.selectedGithubUrls ?? []).map((item) => item.trim()).filter(Boolean)),
  );
  const generalSelected = allSelected.filter((item) => item.startsWith("general:"));
  const urlSelected = allSelected.filter((item) => !item.startsWith("general:"));
  const allowed = new Set(extractProjectSourceUrlsFromArticleText(input.articleBody));
  return urlSelected.filter((item) => allowed.has(item)).length + generalSelected.length;
}

export type DuplicateKind = "strict" | "possible" | "queue_url";

export type ChineseIndieQueueDuplicate = {
  name: string;
  projectUrl: string;
  edition: ChineseIndieCandidateInput["edition"];
  reason: ExistingProjectHit["reason"] | "queue_url";
  duplicateKind: DuplicateKind;
  existingSlug: string;
  existingName: string;
  existingItemId?: string;
};

function isStrictDuplicateReason(reason: ExistingProjectHit["reason"]): boolean {
  return reason === "githubUrl" || reason === "websiteUrl" || reason === "slug";
}

export type BulkQueueChineseIndieOptions = {
  limit?: number;
  dryRun?: boolean;
};

export type BulkQueueChineseIndieResult = {
  queued: number;
  duplicates: ChineseIndieQueueDuplicate[];
  skippedClosed: number;
  skippedInvalid: number;
  failed: number;
  items: DiscoveryItem[];
};

type ExistingProjectIndex = {
  byGithubUrl: Map<string, ExistingProjectHit>;
  byWebsiteUrl: Map<string, ExistingProjectHit>;
  bySlug: Map<string, ExistingProjectHit>;
  byName: Map<string, ExistingProjectHit>;
};

async function loadExistingProjectIndex(): Promise<ExistingProjectIndex> {
  const rows = await prisma.project.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      githubUrl: true,
      websiteUrl: true,
    },
  });
  const byGithubUrl = new Map<string, ExistingProjectHit>();
  const byWebsiteUrl = new Map<string, ExistingProjectHit>();
  const bySlug = new Map<string, ExistingProjectHit>();
  const byName = new Map<string, ExistingProjectHit>();

  for (const row of rows) {
    const hit: ExistingProjectHit = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      reason: "name",
    };
    byName.set(row.name.trim().toLowerCase(), hit);
    bySlug.set(row.slug.toLowerCase(), { ...hit, reason: "slug" });
    if (row.githubUrl?.trim()) {
      byGithubUrl.set(row.githubUrl.trim().toLowerCase(), { ...hit, reason: "githubUrl" });
    }
    if (row.websiteUrl?.trim()) {
      byWebsiteUrl.set(row.websiteUrl.trim().toLowerCase(), { ...hit, reason: "websiteUrl" });
    }
  }

  return { byGithubUrl, byWebsiteUrl, bySlug, byName };
}

function findExistingProjectInIndex(
  index: ExistingProjectIndex,
  input: {
    githubUrl?: string | null;
    websiteUrl?: string | null;
    title: string;
    repo: string;
  },
): ExistingProjectHit | null {
  const githubUrl = input.githubUrl?.trim().toLowerCase() || null;
  if (githubUrl && index.byGithubUrl.has(githubUrl)) {
    return index.byGithubUrl.get(githubUrl)!;
  }
  const websiteUrl = input.websiteUrl?.trim().toLowerCase() || null;
  if (websiteUrl && index.byWebsiteUrl.has(websiteUrl)) {
    return index.byWebsiteUrl.get(websiteUrl)!;
  }
  const candidateSlug = slugifyProjectName(input.title) || slugifyProjectName(input.repo);
  if (candidateSlug && index.bySlug.has(candidateSlug.toLowerCase())) {
    return index.bySlug.get(candidateSlug.toLowerCase())!;
  }
  const byName = index.byName.get(input.title.trim().toLowerCase());
  if (byName) {
    return { ...byName, reason: "name" };
  }
  return null;
}

export function createChineseIndieDiscoveryItem(input: ChineseIndieCandidateInput): DiscoveryItem {
  const now = new Date().toISOString();
  const primaryUrl = input.websiteUrl || input.githubUrl || input.sourceUrl;
  return {
    id: `chinese-indie-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sourceType: "manual",
    title: input.name.trim(),
    url: primaryUrl,
    description: input.description?.trim() || undefined,
    status: "new",
    createdAt: now,
    meta: {
      source: CHINESE_INDIE_SOURCE_KEY,
      sourceKey: CHINESE_INDIE_SOURCE_KEY,
      sourceType: "curated_repository",
      sourceLabel: input.sourceName,
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      sourceArticleUrl: input.sourceArticleUrl,
      githubUrl: input.githubUrl,
      websiteUrl: input.websiteUrl,
      primaryProjectUrl: primaryUrl,
      projectPageUrl: primaryUrl,
      trustLevel: input.meta.trustLevel,
      edition: input.meta.edition,
      developerName: input.meta.developerName,
      developerRegion: input.meta.developerRegion,
      developerLinks: input.meta.developerLinks,
      addedDate: input.meta.addedDate,
      originalStatus: input.meta.originalStatus,
      originalMarkdown: input.meta.originalMarkdown,
      moreInfoUrls: input.meta.moreInfoUrls,
      sourceRepo: input.meta.sourceRepo,
      autoImportAllowed: input.meta.autoImportAllowed,
      readyForReview: input.originalStatus === "ONLINE",
      extractedFrom: "chinese-independent-developer",
    },
  };
}

export async function bulkQueueChineseIndependentDeveloperProjects(
  entries: ChineseIndieCandidateInput[],
  options: BulkQueueChineseIndieOptions = {},
): Promise<BulkQueueChineseIndieResult> {
  const limit = options.limit && options.limit > 0 ? options.limit : undefined;
  const duplicates: ChineseIndieQueueDuplicate[] = [];
  const items: DiscoveryItem[] = [];
  let queued = 0;
  let skippedClosed = 0;
  let skippedInvalid = 0;
  let failed = 0;

  const targetEntries = limit ? entries.slice(0, limit) : entries;
  const existingIndex = await loadExistingProjectIndex();

  for (const entry of targetEntries) {
    if (entry.originalStatus === "CLOSED") {
      skippedClosed += 1;
      continue;
    }
    if (!entry.githubUrl && !entry.websiteUrl) {
      skippedInvalid += 1;
      continue;
    }

    try {
      const existing = findExistingProjectInIndex(existingIndex, {
        githubUrl: entry.githubUrl,
        websiteUrl: entry.websiteUrl,
        title: entry.name,
        repo: entry.name,
      });
      if (existing) {
        if (isStrictDuplicateReason(existing.reason)) {
          duplicates.push({
            name: entry.name,
            projectUrl: entry.githubUrl || entry.websiteUrl || entry.sourceUrl,
            edition: entry.edition,
            reason: existing.reason,
            duplicateKind: "strict",
            existingSlug: existing.slug,
            existingName: existing.name,
          });
          continue;
        }
        // name-only match: possible duplicate — still queue with flag
        const item = createChineseIndieDiscoveryItem(entry);
        item.possibleDuplicate = true;
        item.meta = {
          ...item.meta,
          duplicateKind: "possible",
          duplicateReason: existing.reason,
          existingSlug: existing.slug,
          existingProjectId: existing.id,
        };
        if (options.dryRun) {
          items.push(item);
          queued += 1;
          duplicates.push({
            name: entry.name,
            projectUrl: item.url,
            edition: entry.edition,
            reason: existing.reason,
            duplicateKind: "possible",
            existingSlug: existing.slug,
            existingName: existing.name,
          });
          continue;
        }
        const appended = await appendDiscoveryItem(item);
        if (appended.duplicate) {
          duplicates.push({
            name: entry.name,
            projectUrl: item.url,
            edition: entry.edition,
            reason: "queue_url",
            duplicateKind: "queue_url",
            existingSlug: appended.existingSlug ?? "",
            existingName: entry.name,
            existingItemId: appended.existingItemId,
          });
          continue;
        }
        items.push(item);
        queued += 1;
        duplicates.push({
          name: entry.name,
          projectUrl: item.url,
          edition: entry.edition,
          reason: existing.reason,
          duplicateKind: "possible",
          existingSlug: existing.slug,
          existingName: existing.name,
        });
        continue;
      }

      const item = createChineseIndieDiscoveryItem(entry);
      if (options.dryRun) {
        items.push(item);
        queued += 1;
        continue;
      }
      const appended = await appendDiscoveryItem(item);
      if (appended.duplicate) {
        duplicates.push({
          name: entry.name,
          projectUrl: item.url,
          edition: entry.edition,
          reason: "queue_url",
          duplicateKind: "queue_url",
          existingSlug: appended.existingSlug ?? "",
          existingName: entry.name,
          existingItemId: appended.existingItemId,
        });
        continue;
      }
      items.push(item);
      queued += 1;
    } catch {
      failed += 1;
    }
  }

  return {
    queued,
    duplicates,
    skippedClosed,
    skippedInvalid,
    failed,
    items,
  };
}

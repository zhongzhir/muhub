import type { ProjectStatus } from "@prisma/client";
import { stringArrayFromJson } from "@/lib/discovery/sync-discovery-to-project";
import { prisma } from "@/lib/prisma";
import { formatProjectTagsInput, parseProjectTags } from "@/lib/projects/project-tags";
import { normalizePrimaryCategoryToSlug } from "@/lib/projects/project-categories";
import {
  completenessInputFromParts,
  computeProjectCompleteness,
  publishReadinessMessages,
} from "@/lib/project-completeness";

export type AdminProjectEditInitial = {
  id: string;
  slug: string;
  /** 用于 soft refresh 后强制 remount，使 select 等与服务器 defaultValue 同步 */
  dataUpdatedAt: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string;
  websiteUrl: string;
  githubUrl: string;
  aiCardSummary: string;
  status: ProjectStatus;
  visibilityStatus: string;
  isPublic: boolean;
  publishedAt: string;
  discoverySource: string;
  discoverySourceId: string;
  importedFromCandidateId: string;
  externalLinksText: string;
  readinessMessages: string[];
};

export type ParsedAdminProjectInput = {
  name: string;
  tagline: string | null;
  description: string | null;
  primaryCategory: string | null;
  tags: string[];
  websiteUrl: string | null;
  githubUrl: string | null;
  aiCardSummary: string | null;
  externalLinks: Array<{ platform: string; url: string; label: string | null; isPrimary: boolean }>;
};

export type PublishValidationResult = {
  ok: boolean;
  blockingErrors: string[];
  readinessMessages: string[];
};

function normalizeOptionalUrl(value: string, fieldLabel: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed).href;
  } catch {
    throw new Error(`${fieldLabel}格式不正确，请输入完整的 http(s) 地址。`);
  }
}

function parseExternalLinks(
  text: string,
): Array<{ platform: string; url: string; label: string | null; isPrimary: boolean }> {
  const rows: Array<{ platform: string; url: string; label: string | null; isPrimary: boolean }> = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const parts = line.split(",").map((part) => part.trim());
    if (parts.length < 2) {
      throw new Error('外部链接每行请使用“平台, URL, 标签(可选), primary(可选)”格式。');
    }
    const platform = parts[0];
    const url = normalizeOptionalUrl(parts[1], `外部链接 ${platform}`) ?? "";
    if (!platform || !url) {
      throw new Error("外部链接需要同时填写平台和 URL。");
    }
    const label = parts[2] ? parts[2] : null;
    const isPrimary = parts[3]?.toLowerCase() === "primary";
    const dedupeKey = `${platform.toLowerCase()}:${url.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    rows.push({ platform, url, label, isPrimary });
  }

  return rows;
}

export function parseAdminProjectInput(formData: FormData): ParsedAdminProjectInput {
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const categoryRaw = String(formData.get("category") ?? "").trim();
  const tags = parseProjectTags(String(formData.get("tags") ?? "").trim());
  const websiteUrl = normalizeOptionalUrl(String(formData.get("websiteUrl") ?? ""), "官网链接");
  const githubUrl = normalizeOptionalUrl(String(formData.get("githubUrl") ?? ""), "GitHub 链接");
  const aiCardSummary = String(formData.get("aiCardSummary") ?? "").trim() || null;
  const externalLinks = parseExternalLinks(String(formData.get("externalLinksText") ?? ""));

  if (!name) {
    throw new Error("请填写项目名称。");
  }

  let primaryCategory: string | null = null;
  if (categoryRaw) {
    const normalized = normalizePrimaryCategoryToSlug(categoryRaw);
    if (!normalized) {
      throw new Error("请选择有效的项目分类。");
    }
    primaryCategory = normalized;
  }

  return {
    name,
    tagline,
    description,
    primaryCategory,
    tags,
    websiteUrl,
    githubUrl,
    aiCardSummary,
    externalLinks,
  };
}

export function validateProjectForPublish(input: ParsedAdminProjectInput): PublishValidationResult {
  const blockingErrors: string[] = [];

  if (!input.name.trim()) {
    blockingErrors.push("项目名称未填写");
  }
  if (!input.tagline?.trim() && !input.description?.trim()) {
    blockingErrors.push("至少补充一句话简介或项目详情");
  }
  if (!input.primaryCategory?.trim()) {
    blockingErrors.push("请选择项目分类");
  }
  if (!input.websiteUrl && !input.githubUrl && input.externalLinks.length === 0) {
    blockingErrors.push("至少补充一个官网、GitHub 或外部链接");
  }

  const completeness = computeProjectCompleteness(
    completenessInputFromParts({
      name: input.name,
      tagline: input.tagline,
      description: input.description,
      primaryCategory: input.primaryCategory,
      tags: input.tags,
      websiteUrl: input.websiteUrl,
      githubUrl: input.githubUrl,
      sources: [],
      externalLinks: input.externalLinks.map((item) => ({ platform: item.platform })),
    }),
  );

  return {
    ok: blockingErrors.length === 0,
    blockingErrors,
    readinessMessages: publishReadinessMessages(completeness),
  };
}

export async function fetchAdminProjectForEdit(id: string): Promise<AdminProjectEditInitial | null> {
  const row = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    include: {
      externalLinks: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      sources: { select: { kind: true } },
    },
  });

  if (!row) {
    return null;
  }

  const categorySlugForForm =
    normalizePrimaryCategoryToSlug(row.primaryCategory) ??
    normalizePrimaryCategoryToSlug(stringArrayFromJson(row.categoriesJson)[0]) ??
    "";

  const readiness = computeProjectCompleteness(
    completenessInputFromParts({
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      primaryCategory: categorySlugForForm || null,
      tags: row.tags,
      websiteUrl: row.websiteUrl,
      githubUrl: row.githubUrl,
      sources: row.sources,
      externalLinks: row.externalLinks.map((item) => ({ platform: item.platform })),
    }),
  );

  return {
    id: row.id,
    slug: row.slug,
    dataUpdatedAt: row.updatedAt.toISOString(),
    name: row.name,
    tagline: row.tagline ?? "",
    description: row.description ?? "",
    category: categorySlugForForm,
    tags: formatProjectTagsInput(row.tags),
    websiteUrl: row.websiteUrl ?? "",
    githubUrl: row.githubUrl ?? "",
    aiCardSummary: row.aiCardSummary ?? "",
    status: row.status,
    visibilityStatus: row.visibilityStatus,
    isPublic: row.isPublic,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : "",
    discoverySource: row.discoverySource ?? "",
    discoverySourceId: row.discoverySourceId ?? "",
    importedFromCandidateId: row.importedFromCandidateId ?? "",
    externalLinksText: row.externalLinks
      .map((item) => [item.platform, item.url, item.label ?? "", item.isPrimary ? "primary" : ""].join(", "))
      .join("\n"),
    readinessMessages: publishReadinessMessages(readiness),
  };
}

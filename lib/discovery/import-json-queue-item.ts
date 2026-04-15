/**
 * 将本地 JSON Discovery 队列项导入为正式 Project（与 Prisma DiscoveryCandidate 并存的最小闭环）。
 */
import type { DiscoveryItem } from "@/agents/discovery/discovery-types";
import { updateDiscoveryAiStatus } from "@/agents/discovery/discovery-store";
import type { ProjectSourceKind } from "@prisma/client";
import { parseRepoUrl } from "@/lib/repo-platform";
import { prisma } from "@/lib/prisma";
import { allocateUniqueProjectSlug } from "@/lib/project-allocate-slug";
import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { inferRepoSourceKind } from "@/lib/project-sources";
import { isValidProjectSlug, slugifyProjectName } from "@/lib/project-slug";
import { scheduleProjectAiEnrichment } from "@/lib/ai/enrich-project";
import { createProjectActivity } from "@/lib/activity/project-activity-service";

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
  primaryRepo: { kind: ProjectSourceKind; url: string } | null;
};

function parseItemLink(item: DiscoveryItem): ParsedLink {
  const raw = item.url.trim();
  if (!raw) {
    throw new Error("条目缺少有效 URL");
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("条目 URL 格式无效");
  }
  const host = u.hostname.toLowerCase();
  const parsedRepo = parseRepoUrl(raw);

  if (parsedRepo?.platform === "github" || host === "github.com" || host.endsWith(".github.com")) {
    const githubUrl = normalizeGithubRepoUrl(raw);
    return {
      githubUrl,
      websiteUrl: null,
      primaryRepo: { kind: "GITHUB", url: githubUrl },
    };
  }

  if (parsedRepo?.platform === "gitee") {
    const url = normalizeGithubRepoUrl(raw);
    return {
      githubUrl: null,
      websiteUrl: null,
      primaryRepo: { kind: "GITEE", url },
    };
  }

  return {
    githubUrl: null,
    websiteUrl: u.href,
    primaryRepo: null,
  };
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

  if (link.primaryRepo?.kind === "GITEE") {
    const byGitee = await prisma.project.findFirst({
      where: {
        deletedAt: null,
        sources: { some: { kind: "GITEE", url: link.primaryRepo.url } },
      },
      select: { id: true, slug: true, name: true },
    });
    if (byGitee) {
      return byGitee;
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

  const sourceCreates: { kind: ProjectSourceKind; url: string; isPrimary: boolean }[] = [];
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
  if (link.websiteUrl) {
    sourceCreates.push({
      kind: "WEBSITE",
      url: link.websiteUrl,
      isPrimary: !link.githubUrl && link.primaryRepo?.kind !== "GITEE",
    });
  }

  const project = await prisma.project.create({
    data: {
      name,
      slug,
      tagline,
      description,
      githubUrl: link.githubUrl,
      websiteUrl: link.websiteUrl,
      tags: [],
      sourceType: "discovery-json-queue",
      status: "ACTIVE",
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
    scheduleProjectAiEnrichment(project.slug);
    await updateDiscoveryAiStatus(item.id, "scheduled");
    console.log(`[Discovery] AI enrichment scheduled for project: ${project.slug} (id=${project.id})`);
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

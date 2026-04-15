import type { ProjectUpdateSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";

export type ActivityType =
  | "project_imported"
  | "project_profile_updated"
  | "github_repo_updated"
  | "github_release_detected"
  | "official_update_detected";

type ActivityMetadata = {
  activityType?: ActivityType;
  isPublic?: boolean;
  sourceType?: string;
  dedupeKey?: string;
  [key: string]: unknown;
};

export type ProjectActivity = {
  id: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
  type: ActivityType;
  title: string;
  summary: string | null;
  sourceType: string;
  sourceUrl: string | null;
  occurredAt: string;
  createdAt: string;
  isPublic: boolean;
  metadataJson: Record<string, unknown> | null;
};

function parseMeta(metaJson: string | null): ActivityMetadata {
  if (!metaJson?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(metaJson) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as ActivityMetadata;
    }
    return {};
  } catch {
    return {};
  }
}

function stringifyMeta(input: ActivityMetadata): string {
  return JSON.stringify(input);
}

function mapSourceType(type: ActivityType): ProjectUpdateSourceType {
  if (type === "official_update_detected") {
    return "OFFICIAL";
  }
  if (type === "github_repo_updated" || type === "github_release_detected") {
    return "GITHUB";
  }
  return "SYSTEM";
}

function isActivityType(v: unknown): v is ActivityType {
  return (
    v === "project_imported" ||
    v === "project_profile_updated" ||
    v === "github_repo_updated" ||
    v === "github_release_detected" ||
    v === "official_update_detected"
  );
}

function mapRowToActivity(
  row: {
    id: string;
    projectId: string;
    title: string;
    summary: string | null;
    sourceType: ProjectUpdateSourceType;
    sourceUrl: string | null;
    occurredAt: Date | null;
    createdAt: Date;
    metaJson: string | null;
    project: { slug: string; name: string };
  },
): ProjectActivity | null {
  const meta = parseMeta(row.metaJson);
  const type = meta.activityType;
  if (!isActivityType(type)) {
    return null;
  }
  const isPublic = meta.isPublic !== false;
  if (!isPublic) {
    return null;
  }
  return {
    id: row.id,
    projectId: row.projectId,
    projectSlug: row.project.slug,
    projectName: row.project.name,
    type,
    title: row.title,
    summary: row.summary ?? null,
    sourceType: meta.sourceType || row.sourceType,
    sourceUrl: row.sourceUrl ?? null,
    occurredAt: (row.occurredAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
    isPublic,
    metadataJson: meta,
  };
}

export async function createProjectActivity(input: {
  projectId: string;
  type: ActivityType;
  title: string;
  summary?: string | null;
  sourceType?: string;
  sourceUrl?: string | null;
  occurredAt?: Date;
  isPublic?: boolean;
  dedupeKey?: string;
  metadataJson?: Record<string, unknown> | null;
}): Promise<{ created: boolean; id?: string }> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { created: false };
  }
  const isPublic = input.isPublic !== false;
  const dedupeKey = input.dedupeKey?.trim() || null;
  const sourceType = mapSourceType(input.type);
  const extraMeta = input.metadataJson ?? {};
  const meta: ActivityMetadata = {
    ...extraMeta,
    activityType: input.type,
    isPublic,
    sourceType: input.sourceType ?? sourceType,
    dedupeKey: dedupeKey ?? undefined,
  };

  if (dedupeKey) {
    const latest = await prisma.projectUpdate.findMany({
      where: {
        projectId: input.projectId,
        sourceType,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, metaJson: true },
    });
    const exists = latest.some((row) => parseMeta(row.metaJson).dedupeKey === dedupeKey);
    if (exists) {
      return { created: false };
    }
  }

  const created = await prisma.projectUpdate.create({
    data: {
      projectId: input.projectId,
      sourceType,
      title: input.title,
      summary: input.summary ?? null,
      sourceUrl: input.sourceUrl ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      metaJson: stringifyMeta(meta),
      isAiGenerated: false,
    },
    select: { id: true },
  });
  return { created: true, id: created.id };
}

export async function readRecentPublicActivities(limit = 8): Promise<ProjectActivity[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  const rows = await prisma.projectUpdate.findMany({
    where: {
      project: { ...PROJECT_ACTIVE_FILTER },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: Math.max(20, limit * 4),
    select: {
      id: true,
      projectId: true,
      title: true,
      summary: true,
      sourceType: true,
      sourceUrl: true,
      occurredAt: true,
      createdAt: true,
      metaJson: true,
      project: { select: { slug: true, name: true } },
    },
  });
  const mapped = rows.map(mapRowToActivity).filter((row): row is ProjectActivity => Boolean(row));
  return mapped.slice(0, Math.max(1, limit));
}

export async function readProjectPublicActivities(projectSlug: string, limit = 8): Promise<ProjectActivity[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  const rows = await prisma.projectUpdate.findMany({
    where: {
      project: {
        slug: projectSlug,
        ...PROJECT_ACTIVE_FILTER,
      },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: Math.max(12, limit * 3),
    select: {
      id: true,
      projectId: true,
      title: true,
      summary: true,
      sourceType: true,
      sourceUrl: true,
      occurredAt: true,
      createdAt: true,
      metaJson: true,
      project: { select: { slug: true, name: true } },
    },
  });
  const mapped = rows.map(mapRowToActivity).filter((row): row is ProjectActivity => Boolean(row));
  return mapped.slice(0, Math.max(1, limit));
}

export async function detectMeaningfulProjectProfileChanges(args: {
  before: {
    name: string;
    tagline: string | null;
    description: string | null;
    githubUrl: string | null;
    websiteUrl: string | null;
    primaryCategory: string | null;
    tags: string[];
  };
  after: {
    name: string;
    tagline: string | null;
    description: string | null;
    githubUrl: string | null;
    websiteUrl: string | null;
    primaryCategory: string | null;
    tags: string[];
  };
}): { changed: boolean; summary: string; dedupeKey: string } {
  const changedFields: string[] = [];
  if (args.before.name.trim() !== args.after.name.trim()) {
    changedFields.push("项目名称");
  }
  if ((args.before.tagline ?? "").trim() !== (args.after.tagline ?? "").trim()) {
    changedFields.push("一句话介绍");
  }
  const beforeDesc = (args.before.description ?? "").trim();
  const afterDesc = (args.after.description ?? "").trim();
  const descBecameLong = beforeDesc.length < 30 && afterDesc.length >= 30;
  const descLargeDelta = Math.abs(afterDesc.length - beforeDesc.length) >= 40;
  if (descBecameLong || descLargeDelta) {
    changedFields.push("项目详情");
  }
  if ((args.before.githubUrl ?? "").trim() !== (args.after.githubUrl ?? "").trim()) {
    changedFields.push("代码仓库");
  }
  if ((args.before.websiteUrl ?? "").trim() !== (args.after.websiteUrl ?? "").trim()) {
    changedFields.push("官网链接");
  }
  if ((args.before.primaryCategory ?? "").trim() !== (args.after.primaryCategory ?? "").trim()) {
    changedFields.push("项目分类");
  }
  const beforeTags = [...args.before.tags].sort().join(",");
  const afterTags = [...args.after.tags].sort().join(",");
  if (beforeTags !== afterTags) {
    changedFields.push("标签");
  }
  if (changedFields.length === 0) {
    return { changed: false, summary: "", dedupeKey: "" };
  }
  const summary = `更新了${changedFields.slice(0, 3).join("、")}${changedFields.length > 3 ? "等信息" : ""}`;
  return {
    changed: true,
    summary,
    dedupeKey: `project_profile_updated:${afterTags}:${(args.after.tagline ?? "").trim()}:${(args.after.githubUrl ?? "").trim()}:${(args.after.websiteUrl ?? "").trim()}`,
  };
}

export async function resolveProjectIdAndNameBySlug(slug: string): Promise<{
  id: string;
  name: string;
} | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }
  return prisma.project.findFirst({
    where: { slug, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, name: true },
  });
}

export async function readRecentPublicActivitiesByProjectIds(
  projectIds: string[],
  limit = 8,
): Promise<ProjectActivity[]> {
  if (!process.env.DATABASE_URL?.trim() || projectIds.length === 0) {
    return [];
  }
  const uniqueIds = [...new Set(projectIds)];
  const rows = await prisma.projectUpdate.findMany({
    where: {
      projectId: { in: uniqueIds },
      project: { ...PROJECT_ACTIVE_FILTER },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: Math.max(24, limit * 4),
    select: {
      id: true,
      projectId: true,
      title: true,
      summary: true,
      sourceType: true,
      sourceUrl: true,
      occurredAt: true,
      createdAt: true,
      metaJson: true,
      project: { select: { slug: true, name: true } },
    },
  });
  const mapped = rows.map(mapRowToActivity).filter((row): row is ProjectActivity => Boolean(row));
  return mapped.slice(0, Math.max(1, limit));
}

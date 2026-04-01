import type { ClaimStatus, ProjectSourceKind, ProjectStatus, ProjectVisibilityStatus } from "@prisma/client";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";
import type { ProjectListItem } from "@/lib/project-list";

export type MyProjectRow = ProjectListItem & { id: string };

function mapMyProjectRow(r: {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: ProjectStatus;
  visibilityStatus: ProjectVisibilityStatus;
  githubUrl: string | null;
  websiteUrl: string | null;
  sourceType: string | null;
  claimStatus: ClaimStatus;
  isFeatured: boolean;
  primaryCategory: string | null;
  tags: string[];
  isAiRelated: boolean | null;
  isChineseTool: boolean | null;
  sources: { kind: ProjectSourceKind }[];
  _count: { socialAccounts: number };
  githubSnapshots: { stars: number }[];
}): MyProjectRow {
  const kindSet = new Set<ProjectSourceKind>();
  for (const s of r.sources) {
    kindSet.add(s.kind);
  }
  const stars = r.githubSnapshots[0]?.stars;
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    status: r.status,
    visibilityStatus: r.visibilityStatus,
    githubUrl: r.githubUrl,
    websiteUrl: r.websiteUrl,
    socialCount: r._count.socialAccounts,
    sourceKinds: [...kindSet],
    sourceType: r.sourceType,
    claimStatus: r.claimStatus,
    isFeatured: r.isFeatured,
    primaryCategory: r.primaryCategory,
    plazaTags: [...r.tags].slice(0, 3),
    isAiRelated: r.isAiRelated,
    isChineseTool: r.isChineseTool,
    githubStars: stars !== undefined ? stars : null,
  };
}

const myProjectSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  visibilityStatus: true,
  githubUrl: true,
  websiteUrl: true,
  sourceType: true,
  claimStatus: true,
  isFeatured: true,
  primaryCategory: true,
  tags: true,
  isAiRelated: true,
  isChineseTool: true,
  sources: { select: { kind: true } },
  _count: { select: { socialAccounts: true } },
  githubSnapshots: { orderBy: { fetchedAt: "desc" as const }, take: 1, select: { stars: true } },
} as const;

export async function fetchMyCreatedProjects(userId: string): Promise<MyProjectRow[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  const rows = await prisma.project.findMany({
    where: { createdById: userId, ...PROJECT_ACTIVE_FILTER },
    orderBy: { createdAt: "desc" },
    select: myProjectSelect,
  });
  return rows.map(mapMyProjectRow);
}

/**
 * 合并「创建」与「认领」列表：先按 id 去重，再按 slug 兜底去重；稳定按创建时间倒序。
 * 同一项目在两侧各出现一次时只保留一条（优先保留 created 列表中的那条）。
 */
export function mergeMyProjectRows(created: MyProjectRow[], claimed: MyProjectRow[]): MyProjectRow[] {
  const byId = new Map<string, MyProjectRow>();
  for (const p of created) {
    byId.set(p.id, p);
  }
  for (const p of claimed) {
    if (!byId.has(p.id)) {
      byId.set(p.id, p);
    }
  }
  const seenSlug = new Set<string>();
  const out: MyProjectRow[] = [];
  for (const p of byId.values()) {
    if (seenSlug.has(p.slug)) {
      continue;
    }
    seenSlug.add(p.slug);
    out.push(p);
  }
  out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return out;
}

export async function fetchMyClaimedProjects(userId: string): Promise<MyProjectRow[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  const rows = await prisma.project.findMany({
    where: {
      claimedByUserId: userId,
      claimStatus: "CLAIMED",
      ...PROJECT_ACTIVE_FILTER,
    },
    orderBy: { claimedAt: "desc" },
    select: myProjectSelect,
  });
  return rows.map(mapMyProjectRow);
}

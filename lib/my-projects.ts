import type { ClaimStatus, ProjectSourceKind, ProjectStatus } from "@prisma/client";
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
  status: ProjectStatus;
  githubUrl: string | null;
  websiteUrl: string | null;
  sourceType: string | null;
  claimStatus: ClaimStatus;
  isFeatured: boolean;
  sources: { kind: ProjectSourceKind }[];
  _count: { socialAccounts: number };
}): MyProjectRow {
  const kindSet = new Set<ProjectSourceKind>();
  for (const s of r.sources) {
    kindSet.add(s.kind);
  }
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    createdAt: r.createdAt,
    status: r.status,
    githubUrl: r.githubUrl,
    websiteUrl: r.websiteUrl,
    socialCount: r._count.socialAccounts,
    sourceKinds: [...kindSet],
    sourceType: r.sourceType,
    claimStatus: r.claimStatus,
    isFeatured: r.isFeatured,
  };
}

const myProjectSelect = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  createdAt: true,
  status: true,
  githubUrl: true,
  websiteUrl: true,
  sourceType: true,
  claimStatus: true,
  isFeatured: true,
  sources: { select: { kind: true } },
  _count: { select: { socialAccounts: true } },
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

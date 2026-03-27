import type { ClaimStatus, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProjectListItem } from "@/lib/project-list";

export type MyProjectRow = ProjectListItem;

function mapMyProjectRow(r: {
  slug: string;
  name: string;
  tagline: string | null;
  createdAt: Date;
  status: ProjectStatus;
  githubUrl: string | null;
  sourceType: string | null;
  claimStatus: ClaimStatus;
  isFeatured: boolean;
  _count: { socialAccounts: number };
}): MyProjectRow {
  return {
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    createdAt: r.createdAt,
    status: r.status,
    githubUrl: r.githubUrl,
    socialCount: r._count.socialAccounts,
    sourceType: r.sourceType,
    claimStatus: r.claimStatus,
    isFeatured: r.isFeatured,
  };
}

const myProjectSelect = {
  slug: true,
  name: true,
  tagline: true,
  createdAt: true,
  status: true,
  githubUrl: true,
  sourceType: true,
  claimStatus: true,
  isFeatured: true,
  _count: { select: { socialAccounts: true } },
} as const;

export async function fetchMyCreatedProjects(userId: string): Promise<MyProjectRow[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  const rows = await prisma.project.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    select: myProjectSelect,
  });
  return rows.map(mapMyProjectRow);
}

export async function fetchMyClaimedProjects(userId: string): Promise<MyProjectRow[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  const rows = await prisma.project.findMany({
    where: { claimedByUserId: userId, claimStatus: "CLAIMED" },
    orderBy: { claimedAt: "desc" },
    select: myProjectSelect,
  });
  return rows.map(mapMyProjectRow);
}

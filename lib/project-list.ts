import type { ClaimStatus, Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProjectListItem = {
  slug: string;
  name: string;
  tagline: string | null;
  createdAt: Date;
  status: ProjectStatus;
  githubUrl: string | null;
  websiteUrl: string | null;
  socialCount: number;
  sourceType: string | null;
  claimStatus: ClaimStatus;
  isFeatured: boolean;
};

export async function fetchPublicProjects(
  q?: string | null,
): Promise<{ items: ProjectListItem[]; error: string | null }> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { items: [], error: null };
  }

  const query = typeof q === "string" ? q.trim() : "";
  const where: Prisma.ProjectWhereInput = {
    isPublic: true,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
            { tagline: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const rows = await prisma.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
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
        _count: { select: { socialAccounts: true } },
      },
    });

    return {
      items: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        tagline: r.tagline,
        createdAt: r.createdAt,
        status: r.status,
        githubUrl: r.githubUrl,
        websiteUrl: r.websiteUrl,
        socialCount: r._count.socialAccounts,
        sourceType: r.sourceType,
        claimStatus: r.claimStatus,
        isFeatured: r.isFeatured,
      })),
      error: null,
    };
  } catch (e) {
    console.error("[fetchPublicProjects]", e);
    return {
      items: [],
      error: "暂时无法加载项目列表，请稍后重试。",
    };
  }
}

/** 供 sitemap 枚举公开项目（仅 ACTIVE + isPublic；失败时返回空，保留静态主路由） */
export async function fetchPublicProjectSlugsForSitemap(): Promise<
  { slug: string; updatedAt: Date }[]
> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  try {
    return await prisma.project.findMany({
      where: { isPublic: true, status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
  } catch (e) {
    console.error("[fetchPublicProjectSlugsForSitemap]", e);
    return [];
  }
}

import type {
  ClaimStatus,
  Prisma,
  ProjectSourceKind,
  ProjectStatus,
  ProjectVisibilityStatus,
} from "@prisma/client";
import { PROJECT_PLAZA_FILTER } from "@/lib/project-active-filter";
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
  /** 去重后的信息源类型，用于广场卡片标签 */
  sourceKinds: ProjectSourceKind[];
  sourceType: string | null;
  claimStatus: ClaimStatus;
  isFeatured: boolean;
  visibilityStatus?: ProjectVisibilityStatus;
};

export async function fetchPublicProjects(
  q?: string | null,
): Promise<{ items: ProjectListItem[]; error: string | null }> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { items: [], error: null };
  }

  const query = typeof q === "string" ? q.trim() : "";
  const where: Prisma.ProjectWhereInput = {
    ...PROJECT_PLAZA_FILTER,
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
        sources: { select: { kind: true } },
        _count: { select: { socialAccounts: true } },
      },
    });

    return {
      items: rows.map((r) => {
        const kindSet = new Set<ProjectSourceKind>();
        for (const s of r.sources) {
          kindSet.add(s.kind);
        }
        return {
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
      }),
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

/** 供 sitemap：与广场一致（已公开且未删除） */
export async function fetchPublicProjectSlugsForSitemap(): Promise<
  { slug: string; updatedAt: Date }[]
> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  try {
    return await prisma.project.findMany({
      where: { ...PROJECT_PLAZA_FILTER },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
  } catch (e) {
    console.error("[fetchPublicProjectSlugsForSitemap]", e);
    return [];
  }
}

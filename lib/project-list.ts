import type { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProjectListItem = {
  slug: string;
  name: string;
  tagline: string | null;
  createdAt: Date;
  status: ProjectStatus;
  githubUrl: string | null;
  socialCount: number;
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
        socialCount: r._count.socialAccounts,
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

import type {
  ClaimStatus,
  Prisma,
  ProjectSourceKind,
  ProjectStatus,
  ProjectVisibilityStatus,
} from "@prisma/client";
import {
  computeProjectCompleteness,
  completenessInputFromParts,
  plazaRecommendedSortScore,
} from "@/lib/project-completeness";
import { isProjectCategory } from "@/lib/projects/project-categories";
import { normalizeProjectSearchQuery } from "@/lib/projects/project-search";
import { parseSingleProjectTag } from "@/lib/projects/project-tags";
import { PROJECT_PLAZA_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

export type PlazaSortMode = "new" | "updated" | "github" | "recommended";

export type ProjectListItem = {
  slug: string;
  name: string;
  tagline: string | null;
  createdAt: Date;
  status: ProjectStatus;
  githubUrl: string | null;
  websiteUrl: string | null;
  socialCount: number;
  sourceKinds: ProjectSourceKind[];
  sourceType: string | null;
  claimStatus: ClaimStatus;
  isFeatured: boolean;
  visibilityStatus?: ProjectVisibilityStatus;
  primaryCategory: string | null;
  plazaTags: string[];
  isAiRelated: boolean | null;
  isChineseTool: boolean | null;
  /** 最新仓库快照星标（广场排序/展示） */
  githubStars: number | null;
  updatedAt: Date;
};

export type ProjectPlazaFilters = {
  q?: string;
  category?: string;
  tag?: string;
  isAiRelated?: boolean;
  isChineseTool?: boolean;
  hasWebsite?: boolean;
  hasDocs?: boolean;
  hasGitHub?: boolean;
  sort?: PlazaSortMode;
};

type PlazaDbRow = {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: ProjectStatus;
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
  externalLinks: { platform: string }[];
  _count: { socialAccounts: number };
  githubSnapshots: { stars: number }[];
};

function mapPlazaRow(r: PlazaDbRow): ProjectListItem {
  const kindSet = new Set<ProjectSourceKind>();
  for (const s of r.sources) {
    kindSet.add(s.kind);
  }
  const stars = r.githubSnapshots[0]?.stars;
  return {
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    status: r.status,
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

function sortPlazaItems(items: ProjectListItem[], rows: PlazaDbRow[], sort: PlazaSortMode): ProjectListItem[] {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const list = [...items];

  if (sort === "updated") {
    list.sort((a, b) => bySlug.get(b.slug)!.updatedAt.getTime() - bySlug.get(a.slug)!.updatedAt.getTime());
    return list;
  }

  if (sort === "github") {
    list.sort((a, b) => {
      const sa = bySlug.get(a.slug)!.githubSnapshots[0]?.stars ?? -1;
      const sb = bySlug.get(b.slug)!.githubSnapshots[0]?.stars ?? -1;
      if (sb !== sa) {
        return sb - sa;
      }
      return bySlug.get(b.slug)!.updatedAt.getTime() - bySlug.get(a.slug)!.updatedAt.getTime();
    });
    return list;
  }

  if (sort === "recommended") {
    list.sort((a, b) => {
      const ra = bySlug.get(a.slug)!;
      const rb = bySlug.get(b.slug)!;
      const ca = computeProjectCompleteness(
        completenessInputFromParts({
          name: ra.name,
          tagline: ra.tagline,
          description: ra.description,
          primaryCategory: ra.primaryCategory,
          tags: ra.tags,
          websiteUrl: ra.websiteUrl,
          githubUrl: ra.githubUrl,
          sources: ra.sources,
          externalLinks: ra.externalLinks,
        }),
      );
      const cb = computeProjectCompleteness(
        completenessInputFromParts({
          name: rb.name,
          tagline: rb.tagline,
          description: rb.description,
          primaryCategory: rb.primaryCategory,
          tags: rb.tags,
          websiteUrl: rb.websiteUrl,
          githubUrl: rb.githubUrl,
          sources: rb.sources,
          externalLinks: rb.externalLinks,
        }),
      );
      const hasDocsA =
        ra.sources.some((s) => s.kind === "DOCS") ||
        ra.externalLinks.some((e) => e.platform.toLowerCase() === "docs");
      const hasDocsB =
        rb.sources.some((s) => s.kind === "DOCS") ||
        rb.externalLinks.some((e) => e.platform.toLowerCase() === "docs");
      const scoreA = plazaRecommendedSortScore(ca, {
        isAiRelated: ra.isAiRelated,
        hasDocsSignal: hasDocsA,
        hasWebsiteField: Boolean(ra.websiteUrl?.trim()),
      });
      const scoreB = plazaRecommendedSortScore(cb, {
        isAiRelated: rb.isAiRelated,
        hasDocsSignal: hasDocsB,
        hasWebsiteField: Boolean(rb.websiteUrl?.trim()),
      });
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return ra.updatedAt.getTime() - rb.updatedAt.getTime();
    });
    return list;
  }

  /* new */
  list.sort((a, b) => bySlug.get(b.slug)!.createdAt.getTime() - bySlug.get(a.slug)!.createdAt.getTime());
  return list;
}

const plazaSelect = {
  slug: true,
  name: true,
  tagline: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  status: true,
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
  externalLinks: { select: { platform: true } },
  _count: { select: { socialAccounts: true } },
  githubSnapshots: { orderBy: { fetchedAt: "desc" as const }, take: 1, select: { stars: true } },
} as const;

export async function fetchPublicProjects(
  filters: ProjectPlazaFilters = {},
): Promise<{ items: ProjectListItem[]; error: string | null }> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { items: [], error: null };
  }

  const query = normalizeProjectSearchQuery(filters.q);
  const parts: Prisma.ProjectWhereInput[] = [{ ...PROJECT_PLAZA_FILTER }];

  if (query) {
    const queryLower = query.toLowerCase();
    parts.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
        { tagline: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { tags: { has: queryLower } },
      ],
    });
  }

  const cat = filters.category?.trim();
  if (cat && isProjectCategory(cat)) {
    parts.push({ primaryCategory: cat });
  }

  const tag = parseSingleProjectTag(filters.tag);
  if (tag) {
    parts.push({ tags: { has: tag } });
  }

  if (filters.isAiRelated === true) {
    parts.push({ isAiRelated: true });
  } else if (filters.isAiRelated === false) {
    parts.push({ OR: [{ isAiRelated: false }, { isAiRelated: null }] });
  }

  if (filters.isChineseTool === true) {
    parts.push({ isChineseTool: true });
  } else if (filters.isChineseTool === false) {
    parts.push({ OR: [{ isChineseTool: false }, { isChineseTool: null }] });
  }

  if (filters.hasWebsite === true) {
    parts.push({
      OR: [
        {
          AND: [{ websiteUrl: { not: null } }, { NOT: { websiteUrl: "" } }],
        },
        { sources: { some: { kind: "WEBSITE" } } },
        { externalLinks: { some: { platform: { equals: "website", mode: "insensitive" } } } },
      ],
    });
  } else if (filters.hasWebsite === false) {
    parts.push({
      NOT: {
        OR: [
          {
            AND: [{ websiteUrl: { not: null } }, { NOT: { websiteUrl: "" } }],
          },
          { sources: { some: { kind: "WEBSITE" } } },
          { externalLinks: { some: { platform: { equals: "website", mode: "insensitive" } } } },
        ],
      },
    });
  }

  if (filters.hasDocs === true) {
    parts.push({
      OR: [
        { sources: { some: { kind: "DOCS" } } },
        { externalLinks: { some: { platform: { equals: "docs", mode: "insensitive" } } } },
      ],
    });
  } else if (filters.hasDocs === false) {
    parts.push({
      NOT: {
        OR: [
          { sources: { some: { kind: "DOCS" } } },
          { externalLinks: { some: { platform: { equals: "docs", mode: "insensitive" } } } },
        ],
      },
    });
  }

  if (filters.hasGitHub === true) {
    parts.push({
      OR: [
        {
          AND: [{ githubUrl: { not: null } }, { NOT: { githubUrl: "" } }],
        },
        { sources: { some: { kind: { in: ["GITHUB", "GITEE"] } } } },
        { externalLinks: { some: { platform: { equals: "github", mode: "insensitive" } } } },
      ],
    });
  } else if (filters.hasGitHub === false) {
    parts.push({
      NOT: {
        OR: [
          {
            AND: [{ githubUrl: { not: null } }, { NOT: { githubUrl: "" } }],
          },
          { sources: { some: { kind: { in: ["GITHUB", "GITEE"] } } } },
          { externalLinks: { some: { platform: { equals: "github", mode: "insensitive" } } } },
        ],
      },
    });
  }

  const where: Prisma.ProjectWhereInput =
    parts.length === 1 ? parts[0]! : { AND: parts };

  const sortMode: PlazaSortMode = filters.sort ?? "new";

  try {
    const rows = (await prisma.project.findMany({
      where,
      select: plazaSelect,
    })) as unknown as PlazaDbRow[];

    let items = rows.map(mapPlazaRow);
    items = sortPlazaItems(items, rows, sortMode);

    return { items, error: null };
  } catch (e) {
    console.error("[fetchPublicProjects]", e);
    return {
      items: [],
      error: "暂时无法加载项目列表，请稍后重试。",
    };
  }
}

export type PlazaSpotlights = {
  hotAgents: ProjectListItem[];
  chineseAi: ProjectListItem[];
  recentDiscovered: ProjectListItem[];
  wellFilled: ProjectListItem[];
};

/** 广场顶部发现区块（各 4 条，规则化） */
export async function fetchPlazaSpotlights(): Promise<PlazaSpotlights | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }

  try {
    const [hotRows, zhRows, recentRows, poolRows] = await Promise.all([
      prisma.project.findMany({
        where: {
          ...PROJECT_PLAZA_FILTER,
          OR: [{ primaryCategory: "ai-agents" }, { primaryCategory: "AI Agent" }, { tags: { has: "Agent" } }],
        },
        select: plazaSelect,
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.project.findMany({
        where: { ...PROJECT_PLAZA_FILTER, isChineseTool: true },
        select: plazaSelect,
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.project.findMany({
        where: {
          ...PROJECT_PLAZA_FILTER,
          discoverySource: { not: null },
          discoveredAt: { not: null },
        },
        select: plazaSelect,
        orderBy: { discoveredAt: "desc" },
        take: 4,
      }),
      prisma.project.findMany({
        where: PROJECT_PLAZA_FILTER,
        select: plazaSelect,
        orderBy: { updatedAt: "desc" },
        take: 48,
      }),
    ]);

    const hotAgents = (hotRows as unknown as PlazaDbRow[]).map(mapPlazaRow);
    const chineseAi = (zhRows as unknown as PlazaDbRow[]).map(mapPlazaRow);

    const recentDiscovered = (recentRows as unknown as PlazaDbRow[]).map(mapPlazaRow);

    const pool = poolRows as unknown as PlazaDbRow[];
    const scored = pool.map((r) => {
      const comp = computeProjectCompleteness(
        completenessInputFromParts({
          name: r.name,
          tagline: r.tagline,
          description: r.description,
          primaryCategory: r.primaryCategory,
          tags: r.tags,
          websiteUrl: r.websiteUrl,
          githubUrl: r.githubUrl,
          sources: r.sources,
          externalLinks: r.externalLinks,
        }),
      );
      return { r, score: comp.completenessScore };
    });
    scored.sort((a, b) => b.score - a.score || b.r.updatedAt.getTime() - a.r.updatedAt.getTime());
    const wellFilled = scored.slice(0, 4).map((x) => mapPlazaRow(x.r));

    return { hotAgents, chineseAi, recentDiscovered, wellFilled };
  } catch (e) {
    console.error("[fetchPlazaSpotlights]", e);
    return null;
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

export async function fetchHomepageFeaturedProjects(limit = 6): Promise<ProjectListItem[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  try {
    const rows = (await prisma.project.findMany({
      where: { ...PROJECT_PLAZA_FILTER, isFeatured: true },
      select: plazaSelect,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    })) as unknown as PlazaDbRow[];
    return rows.map(mapPlazaRow);
  } catch (e) {
    console.error("[fetchHomepageFeaturedProjects]", e);
    return [];
  }
}

export async function fetchHomepageLatestProjects(limit = 6): Promise<ProjectListItem[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  try {
    const rows = (await prisma.project.findMany({
      where: { ...PROJECT_PLAZA_FILTER },
      select: plazaSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    })) as unknown as PlazaDbRow[];
    return rows.map(mapPlazaRow);
  } catch (e) {
    console.error("[fetchHomepageLatestProjects]", e);
    return [];
  }
}

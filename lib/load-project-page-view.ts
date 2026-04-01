import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import type { SocialPlatform } from "@prisma/client";
import { demoProjectView, type DemoSocial, type ProjectPageView } from "@/lib/demo-project";
import { mapProjectRowToView } from "@/lib/map-project-row";
import { PROJECT_ACTIVE_FILTER, PROJECT_PLAZA_FILTER } from "@/lib/project-active-filter";
import { canManageProject } from "@/lib/project-permissions";
import { prisma } from "@/lib/prisma";
import { getRecommendedProjectPageView } from "@/lib/recommended-projects";
import { normalizeProjectSlugParam } from "@/lib/route-slug";

/** 详情 / 分享统一：动态按时间倒序 */
function sortProjectUpdatesByTime(updates: ProjectPageView["updates"]): ProjectPageView["updates"] {
  return [...updates].sort((a, b) => {
    const ta = (a.createdAt ?? a.occurredAt).getTime();
    const tb = (b.createdAt ?? b.occurredAt).getTime();
    return tb - ta;
  });
}

const SOCIAL_ORDER: SocialPlatform[] = [
  "WEIBO",
  "WECHAT_OFFICIAL",
  "WECHAT_CHANNELS",
  "DOUYIN",
  "XIAOHONGSHU",
  "BILIBILI",
  "X",
  "DISCORD",
  "REDDIT",
];

export function sortProjectSocials(socials: DemoSocial[]): DemoSocial[] {
  return [...socials].sort((a, b) => {
    const ia = SOCIAL_ORDER.indexOf(a.platform);
    const ib = SOCIAL_ORDER.indexOf(b.platform);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

const projectInclude = {
  socialAccounts: true,
  sources: { orderBy: { createdAt: "asc" as const } },
  updates: { orderBy: { createdAt: "desc" as const }, take: 20 },
  githubSnapshots: { orderBy: { fetchedAt: "desc" as const }, take: 1 },
  weeklySummaries: { orderBy: { createdAt: "desc" as const }, take: 1 },
  externalLinks: true,
};

async function loadPublishedFromDb(slug: string) {
  return prisma.project.findFirst({
    where: { slug, ...PROJECT_PLAZA_FILTER },
    include: projectInclude,
  });
}

async function loadActiveByIdFromDb(id: string) {
  return prisma.project.findFirst({
    where: { id, ...PROJECT_ACTIVE_FILTER },
    include: projectInclude,
  });
}

/** 详情页 / 分享页 / 管理预览：库优先；已删除不占 demo 位；未公开仅管理者可见 */
export async function loadProjectPageView(
  rawSlug: string,
  viewerUserId?: string | null,
): Promise<{
  data: ProjectPageView;
  fromDb: boolean;
  access: "public" | "manager_preview";
} | null> {
  noStore();
  const slug = normalizeProjectSlugParam(rawSlug);

  if (!process.env.DATABASE_URL?.trim()) {
    const data: ProjectPageView | null =
      getRecommendedProjectPageView(slug) ?? (slug === demoProjectView.slug ? demoProjectView : null);
    if (!data) {
      return null;
    }
    return {
      data: { ...data, updates: sortProjectUpdatesByTime(data.updates) },
      fromDb: false,
      access: "public",
    };
  }

  try {
    const stub = await prisma.project.findUnique({
      where: { slug },
      select: {
        id: true,
        deletedAt: true,
        visibilityStatus: true,
        createdById: true,
        claimedByUserId: true,
      },
    });

    if (stub) {
      if (stub.deletedAt != null) {
        return null;
      }
      if (stub.visibilityStatus === "PUBLISHED") {
        const row = await loadPublishedFromDb(slug);
        if (row) {
          const data = mapProjectRowToView(row);
          return {
            data: { ...data, updates: sortProjectUpdatesByTime(data.updates) },
            fromDb: true,
            access: "public",
          };
        }
      }
      if (canManageProject(viewerUserId ?? undefined, stub)) {
        const row = await loadActiveByIdFromDb(stub.id);
        if (row) {
          const data = mapProjectRowToView(row);
          return {
            data: { ...data, updates: sortProjectUpdatesByTime(data.updates) },
            fromDb: true,
            access: "manager_preview",
          };
        }
      }
      return null;
    }
  } catch (e) {
    console.error("[loadProjectPageView]", e);
    return null;
  }

  const data: ProjectPageView | null =
    getRecommendedProjectPageView(slug) ?? (slug === demoProjectView.slug ? demoProjectView : null);
  if (!data) {
    return null;
  }
  return {
    data: { ...data, updates: sortProjectUpdatesByTime(data.updates) },
    fromDb: false,
    access: "public",
  };
}

/**
 * 与详情页共用数据；按 slug + 当前访问者去重（管理员预览与匿名结果不同）。
 */
export const loadProjectPageViewCached = cache(loadProjectPageView);

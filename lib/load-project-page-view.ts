import type { SocialPlatform } from "@prisma/client";
import { demoProjectView, type DemoSocial, type ProjectPageView } from "@/lib/demo-project";
import { mapProjectRowToView } from "@/lib/map-project-row";
import { prisma } from "@/lib/prisma";
import { getRecommendedProjectPageView } from "@/lib/recommended-projects";

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

async function loadFromDb(slug: string): Promise<ProjectPageView | null> {
  if (!process.env.DATABASE_URL?.trim()) {
    return null;
  }
  try {
    const row = await prisma.project.findUnique({
      where: { slug },
      include: {
        socialAccounts: true,
        sources: { orderBy: { createdAt: "asc" } },
        updates: { orderBy: { createdAt: "desc" }, take: 20 },
        githubSnapshots: { orderBy: { fetchedAt: "desc" }, take: 1 },
        weeklySummaries: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!row) {
      return null;
    }
    return mapProjectRowToView(row);
  } catch (e) {
    console.error("[loadProjectPageView] loadFromDb", e);
    return null;
  }
}

/** 详情页 / 分享页共用的项目视图加载（库优先，demo 兜底） */
export async function loadProjectPageView(slug: string): Promise<{
  data: ProjectPageView;
  fromDb: boolean;
} | null> {
  const fromDb = await loadFromDb(slug);
  const data: ProjectPageView | null =
    fromDb ??
    getRecommendedProjectPageView(slug) ??
    (slug === demoProjectView.slug ? demoProjectView : null);

  if (!data) {
    return null;
  }

  return {
    data: { ...data, updates: sortProjectUpdatesByTime(data.updates) },
    fromDb: Boolean(fromDb),
  };
}

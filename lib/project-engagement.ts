import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

export type ProjectEngagementPublic = {
  likeCount: number;
  followCount: number;
  viewerHasLiked: boolean;
  viewerHasFollowed: boolean;
};

const empty: ProjectEngagementPublic = {
  likeCount: 0,
  followCount: 0,
  viewerHasLiked: false,
  viewerHasFollowed: false,
};

/** 详情页：聚合点赞/关注计数与当前访问者状态（未登录则 viewer* 均为 false） */
export async function getProjectEngagementForSlug(
  slug: string,
  viewerUserId: string | undefined,
): Promise<{ projectId: string | null; engagement: ProjectEngagementPublic }> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { projectId: null, engagement: empty };
  }

  try {
    const row = await prisma.project.findFirst({
      where: { slug, ...PROJECT_ACTIVE_FILTER },
      select: {
        id: true,
        _count: {
          select: { likes: true, followers: true },
        },
      },
    });
    if (!row) {
      return { projectId: null, engagement: empty };
    }

    if (!viewerUserId) {
      return {
        projectId: row.id,
        engagement: {
          likeCount: row._count.likes,
          followCount: row._count.followers,
          viewerHasLiked: false,
          viewerHasFollowed: false,
        },
      };
    }

    const [likeRow, followRow] = await Promise.all([
      prisma.projectLike.findUnique({
        where: {
          projectId_userId: { projectId: row.id, userId: viewerUserId },
        },
        select: { id: true },
      }),
      prisma.projectFollow.findUnique({
        where: {
          projectId_userId: { projectId: row.id, userId: viewerUserId },
        },
        select: { id: true },
      }),
    ]);

    return {
      projectId: row.id,
      engagement: {
        likeCount: row._count.likes,
        followCount: row._count.followers,
        viewerHasLiked: Boolean(likeRow),
        viewerHasFollowed: Boolean(followRow),
      },
    };
  } catch (e) {
    console.error("[getProjectEngagementForSlug]", e);
    return { projectId: null, engagement: empty };
  }
}

/** 写入后刷新完整互动快照（用于 Server Action 返回） */
export async function getProjectEngagementSnapshot(
  projectId: string,
  viewerUserId: string,
): Promise<ProjectEngagementPublic> {
  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      deletedAt: true,
      _count: { select: { likes: true, followers: true } },
    },
  });
  if (!row || row.deletedAt) {
    return empty;
  }
  const [likeRow, followRow] = await Promise.all([
    prisma.projectLike.findUnique({
      where: { projectId_userId: { projectId, userId: viewerUserId } },
      select: { id: true },
    }),
    prisma.projectFollow.findUnique({
      where: { projectId_userId: { projectId, userId: viewerUserId } },
      select: { id: true },
    }),
  ]);
  return {
    likeCount: row._count.likes,
    followCount: row._count.followers,
    viewerHasLiked: Boolean(likeRow),
    viewerHasFollowed: Boolean(followRow),
  };
}

/**
 * 未来：用户「已关注项目」列表、订阅任务等。
 * V1 仅提供查询方法，不在 UI 暴露。
 */
export async function getFollowedProjectIdsForUser(userId: string): Promise<string[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }
  const rows = await prisma.projectFollow.findMany({
    where: { userId, project: PROJECT_ACTIVE_FILTER },
    select: { projectId: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => r.projectId);
}

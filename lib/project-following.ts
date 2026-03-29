import { prisma } from "@/lib/prisma";

/**
 * 关系层基础查询：用户 ↔ 关注项目。
 * 后续可扩展：站内更新提醒、邮件摘要、会员/众筹/合作意向、权益推送等（本模块保持查询聚合职责）。
 */

/** 轻量活跃度文案（非正式通知系统；基于动态时间与项目更新时间推导） */
export type FollowingActivityLabel =
  | { tone: "fresh"; text: string }
  | { tone: "days"; text: string }
  | { tone: "quiet"; text: string };

export type FollowingProjectRow = {
  projectId: string;
  slug: string;
  name: string;
  tagline: string | null;
  descriptionSnippet: string | null;
  followedAt: Date;
  likeCount: number;
  followCount: number;
  /** 用于排序/调试：综合后的「最近信号」时间 */
  lastSignalAt: Date;
  activity: FollowingActivityLabel;
};

const RECENT_DAYS = 14;

function snippet(text: string | null | undefined, max = 140): string | null {
  const t = text?.trim();
  if (!t) {
    return null;
  }
  const one = t.replace(/\s+/g, " ");
  return one.length <= max ? one : `${one.slice(0, max)}…`;
}

/**
 * 最近信号时间：优先取最新一条 ProjectUpdate 的展示时间，否则退回 `Project.updatedAt`。
 * （若未来接入正式通知队列，可在此替换为 notify.cursor 等字段，而不用改 UI 列表结构。）
 */
function resolveLastSignalAt(project: {
  updatedAt: Date;
  updates: { createdAt: Date; occurredAt: Date | null }[];
}): Date {
  const updateTimes = project.updates.map((u) => (u.occurredAt ?? u.createdAt).getTime());
  const maxUpdate = updateTimes.length ? Math.max(...updateTimes) : null;
  const base = project.updatedAt.getTime();
  if (maxUpdate != null && maxUpdate > base) {
    return new Date(maxUpdate);
  }
  return project.updatedAt;
}

export function activityLabelFromSignal(lastSignalAt: Date, now = new Date()): FollowingActivityLabel {
  const ms = now.getTime() - lastSignalAt.getTime();
  if (ms < 0) {
    return { tone: "fresh", text: "最近有更新" };
  }
  const hours = ms / 3600000;
  if (hours < 48) {
    return { tone: "fresh", text: "最近有更新" };
  }
  const days = Math.floor(ms / 86400000);
  if (days <= RECENT_DAYS) {
    return { tone: "days", text: `${days} 天前更新` };
  }
  return { tone: "quiet", text: "暂无最近更新" };
}

function mapRow(follow: {
  createdAt: Date;
  project: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    description: string | null;
    updatedAt: Date;
    _count: { likes: number; followers: number };
    updates: { createdAt: Date; occurredAt: Date | null }[];
  };
}): FollowingProjectRow {
  const lastSignalAt = resolveLastSignalAt(follow.project);
  return {
    projectId: follow.project.id,
    slug: follow.project.slug,
    name: follow.project.name,
    tagline: follow.project.tagline,
    descriptionSnippet: snippet(follow.project.description),
    followedAt: follow.createdAt,
    likeCount: follow.project._count.likes,
    followCount: follow.project._count.followers,
    lastSignalAt,
    activity: activityLabelFromSignal(lastSignalAt),
  };
}

/** 当前用户关注的项目列表（按关注时间倒序） */
export async function getFollowingProjectsForUser(userId: string): Promise<FollowingProjectRow[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }

  const rows = await prisma.projectFollow.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: {
          id: true,
          slug: true,
          name: true,
          tagline: true,
          description: true,
          updatedAt: true,
          _count: { select: { likes: true, followers: true } },
          updates: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true, occurredAt: true },
          },
        },
      },
    },
  });

  return rows.map(mapRow);
}

/**
 * 预留：按关注关系聚合「近期有动态的项」，供后续摘要推送 / Dashboard widget。
 * V1.1 未调用，结构与 getFollowingProjectsForUser 对齐即可扩展。
 */
export async function getRecentFollowingUpdatesForUser(
  userId: string,
  opts?: { withinDays?: number },
): Promise<FollowingProjectRow[]> {
  const withinDays = opts?.withinDays ?? RECENT_DAYS;
  const all = await getFollowingProjectsForUser(userId);
  return all.filter((r) => {
    const days = (Date.now() - r.lastSignalAt.getTime()) / 86400000;
    return days <= withinDays;
  });
}

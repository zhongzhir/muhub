/**
 * 站内轻通知（V1）：关注项目 → 手动发布动态 → fan-out 至关注用户。
 * 后续可扩展：邮件、推送、会员权益、合作与众筹进展等，尽量复用 ProjectNotificationEvent / UserNotification。
 */

import { prisma } from "@/lib/prisma";

export type DashboardFollowingNotificationRow = {
  id: string;
  projectSlug: string;
  projectName: string;
  eventTitle: string;
  message: string;
  createdAt: Date;
  readAt: Date | null;
};

/**
 * 手动动态发布后：写入项目事件，并向所有 ProjectFollow 用户各生成一条 UserNotification。
 * 幂等：同一批 fan-out 依赖 DB 唯一键；事件本身每条动态只创建一次（由调用方保证）。
 */
export async function createAndFanOutUpdatePostedNotification(params: {
  projectId: string;
  projectSlug: string;
  projectName: string;
  sourceUpdateId: string;
  updateTitle: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }

  const title = "你关注的项目有新动态";
  const message = `「${params.projectName}」发布了新动态：${params.updateTitle}`;

  const follows = await prisma.projectFollow.findMany({
    where: { projectId: params.projectId },
    select: { userId: true },
  });
  if (follows.length === 0) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const event = await tx.projectNotificationEvent.create({
      data: {
        projectId: params.projectId,
        type: "UPDATE_POSTED",
        title,
        message,
        sourceUpdateId: params.sourceUpdateId,
      },
    });

    await tx.userNotification.createMany({
      data: follows.map((f) => ({
        userId: f.userId,
        projectNotificationEventId: event.id,
        projectId: params.projectId,
      })),
      skipDuplicates: true,
    });
  });
}

/** Header 角标：当前用户未读的「关注项目更新」通知条数 */
export async function getUnreadFollowingNotificationCount(userId: string): Promise<number> {
  if (!process.env.DATABASE_URL?.trim()) {
    return 0;
  }
  try {
    return await prisma.userNotification.count({
      where: { userId, readAt: null },
    });
  } catch (e) {
    console.error("[getUnreadFollowingNotificationCount]", e);
    return 0;
  }
}

/** Dashboard：最近若干条「关注项目」相关通知（含已读状态） */
export async function getRecentFollowingUpdateNotificationsForUser(
  userId: string,
  take = 8,
): Promise<DashboardFollowingNotificationRow[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return [];
  }

  try {
    const rows = await prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        event: true,
        project: { select: { slug: true, name: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      projectSlug: r.project.slug,
      projectName: r.project.name,
      eventTitle: r.event.title,
      message: r.event.message,
      createdAt: r.createdAt,
      readAt: r.readAt,
    }));
  } catch (e) {
    console.error("[getRecentFollowingUpdateNotificationsForUser]", e);
    return [];
  }
}

export async function markUserNotificationAsRead(userId: string, userNotificationId: string): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) {
    return false;
  }
  const row = await prisma.userNotification.findFirst({
    where: { id: userNotificationId, userId },
    select: { id: true, readAt: true },
  });
  if (!row) {
    return false;
  }
  if (row.readAt) {
    return true;
  }
  await prisma.userNotification.update({
    where: { id: row.id },
    data: { readAt: new Date() },
  });
  return true;
}

export async function markAllUserFollowingNotificationsRead(userId: string): Promise<number> {
  if (!process.env.DATABASE_URL?.trim()) {
    return 0;
  }
  const res = await prisma.userNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.count;
}

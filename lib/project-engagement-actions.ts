"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getProjectEngagementSnapshot } from "@/lib/project-engagement";
import { prisma } from "@/lib/prisma";
import { normalizeProjectSlugParam } from "@/lib/route-slug";

export type ProjectEngagementActionState =
  | {
      ok: true;
      likeCount: number;
      followCount: number;
      viewerHasLiked: boolean;
      viewerHasFollowed: boolean;
    }
  | { ok: false; error: string };

async function resolveProjectOrError(slug: string) {
  const normalized = normalizeProjectSlugParam(slug);
  if (!process.env.DATABASE_URL?.trim()) {
    return { error: "互动功能需要数据库连接。", project: null as null };
  }
  const project = await prisma.project.findUnique({
    where: { slug: normalized },
    select: { id: true },
  });
  if (!project) {
    return { error: "项目不存在或已下线。", project: null as null };
  }
  return { error: null, project };
}

export async function toggleProjectLike(slug: string): Promise<ProjectEngagementActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再点赞。" };
  }
  const uid = session.user.id;
  const { error, project } = await resolveProjectOrError(slug);
  if (error || !project) {
    return { ok: false, error: error ?? "项目不存在。" };
  }

  try {
    const existing = await prisma.projectLike.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: uid } },
    });
    if (existing) {
      await prisma.projectLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.projectLike.create({
        data: { projectId: project.id, userId: uid },
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const snap = await getProjectEngagementSnapshot(project.id, uid);
      return { ok: true, ...snap };
    }
    console.error("[toggleProjectLike]", e);
    return { ok: false, error: "操作失败，请稍后重试。" };
  }

  const snap = await getProjectEngagementSnapshot(project.id, uid);
  return { ok: true, ...snap };
}

export async function toggleProjectFollow(slug: string): Promise<ProjectEngagementActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再关注项目。" };
  }
  const uid = session.user.id;
  const { error, project } = await resolveProjectOrError(slug);
  if (error || !project) {
    return { ok: false, error: error ?? "项目不存在。" };
  }

  try {
    const existing = await prisma.projectFollow.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: uid } },
    });
    if (existing) {
      await prisma.projectFollow.delete({ where: { id: existing.id } });
    } else {
      await prisma.projectFollow.create({
        data: { projectId: project.id, userId: uid },
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const snap = await getProjectEngagementSnapshot(project.id, uid);
      return { ok: true, ...snap };
    }
    console.error("[toggleProjectFollow]", e);
    return { ok: false, error: "操作失败，请稍后重试。" };
  }

  const snap = await getProjectEngagementSnapshot(project.id, uid);
  return { ok: true, ...snap };
}

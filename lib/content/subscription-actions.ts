"use server"

import { Prisma } from "@prisma/client"
import { auth } from "@/auth"
import type { ProjectEngagementActionState } from "@/lib/project-engagement-actions"
import { getProjectEngagementSnapshot } from "@/lib/project-engagement"
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter"
import { prisma } from "@/lib/prisma"
import { normalizeProjectSlugParam } from "@/lib/route-slug"

async function resolveActiveProjectOrError(slug: string) {
  const normalized = normalizeProjectSlugParam(slug)
  if (!process.env.DATABASE_URL?.trim()) {
    return { error: "需要数据库连接。", project: null as null }
  }
  const project = await prisma.project.findFirst({
    where: { slug: normalized, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, slug: true },
  })
  if (!project) {
    return { error: "项目不存在或已下线。", project: null as null }
  }
  return { error: null, project }
}

/** 创建订阅（已存在则幂等成功） */
export async function followContentSubscription(slug: string): Promise<ProjectEngagementActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再订阅项目。" }
  }
  const uid = session.user.id
  const { error, project } = await resolveActiveProjectOrError(slug)
  if (error || !project) {
    return { ok: false, error: error ?? "项目不存在。" }
  }

  try {
    await prisma.projectFollow.create({
      data: { projectId: project.id, userId: uid },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const snap = await getProjectEngagementSnapshot(project.id, uid)
      return { ok: true, ...snap }
    }
    console.error("[followContentSubscription]", e)
    return { ok: false, error: "操作失败，请稍后重试。" }
  }

  const snap = await getProjectEngagementSnapshot(project.id, uid)
  return { ok: true, ...snap }
}

/** 取消订阅（不存在则幂等成功） */
export async function unfollowContentSubscription(slug: string): Promise<ProjectEngagementActionState> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, error: "请先登录后再管理订阅。" }
  }
  const uid = session.user.id
  const { error, project } = await resolveActiveProjectOrError(slug)
  if (error || !project) {
    return { ok: false, error: error ?? "项目不存在。" }
  }

  try {
    await prisma.projectFollow.deleteMany({
      where: { projectId: project.id, userId: uid },
    })
  } catch (e) {
    console.error("[unfollowContentSubscription]", e)
    return { ok: false, error: "操作失败，请稍后重试。" }
  }

  const snap = await getProjectEngagementSnapshot(project.id, uid)
  return { ok: true, ...snap }
}

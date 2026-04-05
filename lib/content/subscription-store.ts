import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter"
import { prisma } from "@/lib/prisma"
import type { ContentSubscriptionWithProject } from "./subscription-types"

function mapFollowRow(row: {
  id: string
  userId: string
  createdAt: Date
  project: { slug: string; name: string; tagline: string | null }
}): ContentSubscriptionWithProject {
  return {
    id: row.id,
    userId: row.userId,
    projectSlug: row.project.slug,
    createdAt: row.createdAt,
    projectName: row.project.name,
    tagline: row.project.tagline,
  }
}

/**
 * 当前用户的项目内容订阅列表；仅按订阅创建时间倒序，无推荐或重排。
 */
export async function listContentSubscriptionsForUser(userId: string): Promise<ContentSubscriptionWithProject[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return []
  }

  const rows = await prisma.projectFollow.findMany({
    where: { userId, project: PROJECT_ACTIVE_FILTER },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: { slug: true, name: true, tagline: true },
      },
    },
  })

  return rows.map(mapFollowRow)
}

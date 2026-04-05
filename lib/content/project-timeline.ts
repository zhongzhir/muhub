import type { SiteContent } from "@/agents/growth/launch-plan-types"
import type { DemoUpdate } from "@/lib/demo-project"

/** 时间线来源：仅做信息归类，不做价值或推荐判断 */
export type ProjectTimelineSourceType = "project_update" | "site_content"

/**
 * 项目详情页统一时间线条目（运行时组装，无 DB migration）。
 */
export type ProjectTimelineItem = {
  id: string
  projectSlug: string
  sourceType: ProjectTimelineSourceType
  sourceId: string
  title: string
  summary: string | null
  /** ISO 8601，用于排序与展示 */
  occurredAt: string
  /** 无外部或站内目标时可为 null */
  href: string | null
  meta?: Record<string, string | boolean | undefined>
}

function summaryFromUpdate(u: DemoUpdate): string | null {
  if (u.summary?.trim()) {
    return u.summary.trim()
  }
  if (u.content?.trim()) {
    const t = u.content.trim()
    return t.length > 220 ? `${t.slice(0, 219)}…` : t
  }
  return null
}

/**
 * 合并项目动态与关联 SiteContent，按 occurredAt 倒序；不计算权重或推荐分。
 */
export function buildProjectTimelineItems(
  projectSlug: string,
  updates: DemoUpdate[],
  siteRows: SiteContent[],
): ProjectTimelineItem[] {
  const items: ProjectTimelineItem[] = []

  updates.forEach((u, i) => {
    const t = u.createdAt ?? u.occurredAt
    const sourceId = u.id ?? `idx-${i}-${t.getTime()}`
    const href = u.sourceUrl?.trim() ? u.sourceUrl.trim() : null
    items.push({
      id: `timeline-project_update-${sourceId}`,
      projectSlug,
      sourceType: "project_update",
      sourceId: String(sourceId),
      title: u.title,
      summary: summaryFromUpdate(u),
      occurredAt: t.toISOString(),
      href,
      meta: { updateSourceType: String(u.sourceType) },
    })
  })

  for (const s of siteRows) {
    items.push({
      id: `timeline-site_content-${s.id}`,
      projectSlug,
      sourceType: "site_content",
      sourceId: s.id,
      title: s.title,
      summary: s.summary?.trim() || null,
      occurredAt: s.publishedAt,
      href: `/content#${encodeURIComponent(s.id)}`,
      meta: { contentType: s.contentType },
    })
  }

  return items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

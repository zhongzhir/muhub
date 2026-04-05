import type { ContentDraftType } from "@/agents/content/content-types"
import type { SiteContent } from "@/agents/growth/launch-plan-types"

/** /content?type= 与 SiteContent.contentType 的对应（仅分类，无推荐权重） */
export type ContentStreamTabId = "all" | "spotlight" | "updates" | "digest" | "topics"

export function parseContentStreamTab(type: string | undefined | string[]): ContentStreamTabId {
  const raw = Array.isArray(type) ? type[0] : type
  const t = raw?.toLowerCase().trim()
  if (t === "spotlight" || t === "updates" || t === "digest" || t === "topics") {
    return t
  }
  return "all"
}

/**
 * Tab → contentType；不涉及评分或排序权重。
 * 说明：当前草稿类型无独立的 weekly-digest，周报/多项目汇总均为 project-roundup，
 * 故 Updates 与 Digest 暂命中同一 contentType（仅 Tab 区分，便于后续扩展）。
 */
function tabToContentTypes(tab: Exclude<ContentStreamTabId, "all">): ContentDraftType[] {
  switch (tab) {
    case "spotlight":
      return ["project-spotlight"]
    case "updates":
    case "digest":
      return ["project-roundup"]
    case "topics":
      return ["trend-observation"]
    default:
      return []
  }
}

/** 在已按 publishedAt DESC 排序的列表上原地过滤；不重新排序 */
export function filterSiteContentByTab(items: SiteContent[], tab: ContentStreamTabId): SiteContent[] {
  if (tab === "all") {
    return items
  }
  const types = tabToContentTypes(tab)
  return items.filter((i) => types.includes(i.contentType))
}

export function parseContentSearchQuery(q: string | string[] | undefined): string {
  const raw = Array.isArray(q) ? q[0] : q
  return raw?.trim() ?? ""
}

/**
 * 用户主动子串查询；仅匹配 title / summary，不改变 publishedAt 相对顺序。
 */
export function filterSiteContentByKeyword(items: SiteContent[], keyword: string): SiteContent[] {
  const k = keyword.trim()
  if (!k) {
    return items
  }
  return items.filter((i) => i.title.includes(k) || (i.summary?.includes(k) ?? false))
}

/**
 * 仅保留 `relatedProjectIds` 与用户订阅项目 slug 有交集的条目。
 * 不改变相对顺序（输入应为已按 publishedAt DESC，如 `readSiteContentLatestFirst`）。
 */
export function filterSiteContentBySubscribedProjectSlugs(
  items: SiteContent[],
  projectSlugs: string[],
): SiteContent[] {
  if (projectSlugs.length === 0) {
    return []
  }
  const slugSet = new Set(projectSlugs.map((s) => s.trim()).filter((s) => s.length > 0))
  if (slugSet.size === 0) {
    return []
  }
  return items.filter((item) => item.relatedProjectIds?.some((id) => slugSet.has(id)) ?? false)
}

/** Tab + 可选搜索词 → /content 链接（切换分类时保留 q） */
export function buildContentStreamHref(tab: ContentStreamTabId, q?: string): string {
  const params = new URLSearchParams()
  if (tab !== "all") {
    params.set("type", tab)
  }
  const qt = q?.trim()
  if (qt) {
    params.set("q", qt)
  }
  const s = params.toString()
  return s ? `/content?${s}` : "/content"
}

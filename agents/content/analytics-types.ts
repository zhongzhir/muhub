/**
 * Content Analytics V1：对已发布内容与支持数据的结构性快照；不含评分、归因或推荐结论。
 */

/** 按 UTC 日历日聚合的已发布条数（key: YYYY-MM-DD） */
export type PublishedByDay = Record<string, number>

/**
 * 按 UTC「周一起始周」聚合（key: 该周周一 YYYY-MM-DD，便于对齐与复核）。
 */
export type PublishedByWeek = Record<string, number>

export type ContentByTypeCounts = Record<string, number>

export type ProjectRelatedContentCounts = Record<string, number>

export type FollowingCoverageSnapshot = {
  /** 数据库可用时为 true */
  dbAvailable: boolean
  /** 所有关注关系中涉及的不重复项目 slug 数（仅 deletedAt 过滤后的项目） */
  subscribedProjectSlugCount: number
  /** 上述 slug 中，至少有一条 SiteContent.relatedProjectIds 含该 slug 的数量 */
  subscribedProjectsWithRelatedSiteContentCount: number
}

export type ContentAnalyticsSnapshot = {
  generatedAt: string
  totalSiteContent: number
  /** 各 contentType 条数；序列化时按类型名排序以保持中性、可复现 */
  byContentType: ContentByTypeCounts
  byProjectCoverage: {
    /** 至少在一条内容中出现于 relatedProjectIds 的不重复 slug 数 */
    distinctProjectsWithRelatedContent: number
    /** 各 slug 被关联的内容条数；键按字典序排列 */
    relatedContentCountByProjectSlug: ProjectRelatedContentCounts
  }
  publishedByDay: PublishedByDay
  publishedByWeek: PublishedByWeek
  followingCoverage: FollowingCoverageSnapshot
  /** 外发记录总条数（generic 等渠道的生成记录） */
  externalPublishCount: number
  /** 可选说明，仅陈述统计口径，不作价值判断 */
  notes?: string[]
}

export type ContentAnalyticsFile = {
  latest: ContentAnalyticsSnapshot
  /** 本次运行前的快照，便于追溯；长度有上限 */
  history: ContentAnalyticsSnapshot[]
}

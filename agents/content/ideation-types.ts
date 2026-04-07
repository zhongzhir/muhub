/**
 * Content Ideation Agent：创意清单类型，与草稿（ContentDraft）/ 发布计划分离，供后续 Content Agent 消费。
 */

export type ContentIdeaType =
  | "project_spotlight"
  | "project_update_roundup"
  | "topic_watch"
  | "weekly_digest"
  | "followup_topic"

export type ContentIdeaSourceType = "project_update" | "site_content" | "manual_topic" | "mixed"

export type ContentIdeaStatus = "new" | "accepted" | "rejected" | "converted"

/** 单条内容创意；priority 均为中性档位，不作「重要性」排序依据 */
export type ContentIdea = {
  id: string
  ideaType: ContentIdeaType
  title: string
  summary: string
  sourceType: ContentIdeaSourceType
  projectSlugs?: string[]
  relatedContentIds?: string[]
  /** 可追溯的简短事实线索，便于人工复核 */
  evidence?: string[]
  /** 中性占位：V1 一律 0，不参与推荐价值比较 */
  priority: number
  status: ContentIdeaStatus
  createdAt: string
}

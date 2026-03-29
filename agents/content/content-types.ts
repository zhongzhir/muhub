/**
 * 内容草稿类型（V1.2：模板生成，后续可对接 LLM 与数据库）。
 */

export type ContentDraftType =
  | "project-roundup"
  | "trend-observation"
  | "project-spotlight"
  | "social-post"

export type ContentChannel =
  | "article"
  | "wechat"
  | "xiaohongshu"
  | "x"
  | "community"

export type ContentDraft = {
  id: string
  type: ContentDraftType
  channel: ContentChannel
  title: string
  summary?: string
  body: string
  sourceProjectSlugs?: string[]
  sourceProjectNames?: string[]
  generatedAt: string
  generatedBy: "content-agent"
  status: "draft"
}

/** 与站内 Project / Growth 发现数据弱耦合的输入，便于映射与单测 */
export type ContentProjectInput = {
  slug?: string
  name: string
  tagline?: string
  description?: string
  tags?: string[]
  sourceType?: string
  websiteUrl?: string
  githubUrl?: string
}

/** 社媒短帖语气版本（V1.2 默认仅「推荐版」完整输出，其余结构预留） */
export type SocialPostVariant = "default" | "concise" | "recommend" | "observation"

/** 冷启动标题/叙事方向（模板层选用） */
export type ColdStartRoundupThemeId =
  | "today-ai-five"
  | "weekly-cn-ai-opensource"
  | "interesting-domestic-picks"

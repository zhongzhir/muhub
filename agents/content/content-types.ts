/**
 * 内容草稿类型（V1.2：模板生成，后续可对接 LLM 与数据库）。
 * Content Agent V1 契约见 docs/content-agent-v1.md。
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

/** 草稿生命周期（含历史字面量 draft，解析时与 created 等价处理） */
export type ContentDraftStatus =
  | "created"
  | "draft"
  | "review_pending"
  | "review_passed"
  | "review_failed"
  | "bundled"
  | "archived"

export type ContentOpportunityType =
  | "project_spotlight"
  | "project_update_roundup"
  | "weekly_digest"
  | "manual_topic"

/** 机会来源归类（运营手建 / 发现侧 / 定时任务等） */
export type ContentOpportunitySourceType = "manual" | "discovery" | "scheduler" | "dashboard"

export type ContentEvidenceItem = {
  url?: string
  note?: string
  sourceKey?: string
}

/** 与 ContentProjectInput 同构，用于机会中的项目引用 */
export type ContentProjectRef = {
  slug?: string
  name: string
  tagline?: string
  description?: string
  tags?: string[]
  sourceType?: string
  websiteUrl?: string
  githubUrl?: string
}

/** Content Agent V1 标准输入 */
export type ContentOpportunity = {
  id: string
  type: ContentOpportunityType
  sourceType: ContentOpportunitySourceType
  title: string
  summary: string
  projectRefs: ContentProjectRef[]
  topicRefs: string[]
  evidence: ContentEvidenceItem[]
  priority: "low" | "normal" | "high"
  /** 素材新鲜度提示，供模板语气选用 */
  freshness: "stale" | "current" | "live"
  language: "zh-CN" | "en" | "zh-CN-en-mix"
  createdAt: string
}

export type ContentDraft = {
  id: string
  /** 关联 ContentOpportunity.id；旧草稿可无 */
  opportunityId?: string
  type: ContentDraftType
  /** 与 type 一致，便于序列化与外部契约对齐 */
  contentType: ContentDraftType
  channel: ContentChannel
  title: string
  summary?: string
  body: string
  /** 主行动号召文案（可与正文尾部 CTA 块对应） */
  cta?: string
  sourceProjectSlugs?: string[]
  sourceProjectNames?: string[]
  generatedAt: string
  createdAt: string
  generatedBy: "content-agent"
  status: ContentDraftStatus
  reviewFlags?: string[]
  qualityScore?: number
}

/** 与站内 Project / Growth 发现数据弱耦合的输入，便于映射与单测 */
export type ContentProjectInput = ContentProjectRef

/** 社媒短帖语气版本（V1.2 默认仅「推荐版」完整输出，其余结构预留） */
export type SocialPostVariant = "default" | "concise" | "recommend" | "observation"

/** 冷启动标题/叙事方向（模板层选用） */
export type ColdStartRoundupThemeId =
  | "today-ai-five"
  | "weekly-cn-ai-opensource"
  | "interesting-domestic-picks"

/** V1 发布资产包（供 Growth 消费；与 agents/growth/content-bundle 中结构并存，后续可收敛） */
export type ContentAgentBundle = {
  id: string
  opportunityId: string
  bundleType: "spotlight" | "update_roundup" | "weekly_digest" | "manual_topic" | "mixed"
  draftIds: string[]
  channelTargets: ContentChannel[]
  reviewStatus: "pending" | "passed" | "failed"
  launchReadiness: "draft" | "ready_for_launch" | "hold" | "archived"
  createdAt: string
}

/**
 * 外发素材生成 V1：仅本地记录与剪贴板，不接 OAuth、不自动发帖、不排期。
 */

/** 外发模板 / 记录渠道：对应剪贴板文案形态，不接 API */
export type ExternalPublishChannel = "generic" | "twitter" | "linkedin"

/** 记录状态：已生成草稿文案，由人工复制后到外站发布 */
export type ExternalPublishStatus = "generated"

export type ExternalPublishRecord = {
  id: string
  contentId: string
  channel: ExternalPublishChannel
  status: ExternalPublishStatus
  createdAt: string
}

/** `generateExternalPost` 结构化输出 */
export type ExternalPostPayload = {
  title: string
  summary: string
  url: string
  hashtags: string[]
}

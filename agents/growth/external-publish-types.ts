/**
 * 外发素材生成 V1：仅本地记录与剪贴板，不接 OAuth、不自动发帖、不排期。
 */

/** 外发渠道占位；V1 统一为 generic（运营自选平台粘贴） */
export type ExternalPublishChannel = "generic"

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

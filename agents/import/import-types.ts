/**
 * 统一「导入候选」结构：手动表单、未来 OCR / 海报 / 展会照片等均收敛为此类型，
 * 再经 normalize 映射到站内项目创建所需 FormData / Prisma 字段。
 */

export type ImportCandidate = {
  name: string
  description?: string
  url?: string
  tags?: string[]
  sourceId: string
  sourceLabel?: string
  notes?: string
  /** 预留：视觉 / OCR / 批量文本等导入路径 */
  rawInputType?: "manual-form" | "image-poster" | "event-photo" | "text" | "other"
}

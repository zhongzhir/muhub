/**
 * V1.1：来源注册表类型定义。
 * 当前数据为静态配置；后续可迁移到数据库或 CMS，保持本类型稳定即可对接。
 */

export type ProjectSourceRegistryItem = {
  id: string
  name: string
  type:
    | "code"
    | "community"
    | "media"
    | "manual"
    | "incubator"
    | "event"
    | "other"
  url?: string
  region?: "cn" | "global" | "other"
  enabled: boolean
  notes?: string
}

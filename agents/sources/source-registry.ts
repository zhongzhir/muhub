/**
 * V1.1 静态「项目来源注册表」。
 *
 * - 当前实现：模块内常量数组，便于运营扩展与代码审阅。
 * - 未来：可替换为 DB / JSON 文件 / 远程配置，保留 getProjectSourceById 与 getEnabledProjectSources 接口。
 */

import type { ProjectSourceRegistryItem } from "./types"

/** 内置来源清单（按 id 唯一） */
const BUILT_IN_PROJECT_SOURCES: ProjectSourceRegistryItem[] = [
  {
    id: "github-cn",
    name: "GitHub 中国项目",
    type: "code",
    url: "https://github.com",
    region: "cn",
    enabled: true,
    notes: "V1 mock discovery；后续接 API / 榜单",
  },
  {
    id: "gitee",
    name: "Gitee",
    type: "code",
    url: "https://gitee.com",
    region: "cn",
    enabled: true,
    notes: "V1 mock discovery；后续接开放 API",
  },
  {
    id: "v2ex",
    name: "V2EX",
    type: "community",
    url: "https://v2ex.com",
    region: "cn",
    enabled: true,
    notes: "V1 mock discovery；后续接许可内抓取或官方合作",
  },
  {
    id: "manual",
    name: "手动录入",
    type: "manual",
    region: "cn",
    enabled: true,
    notes: "运营 / 贡献者手填；与 Dashboard 导入页联动",
  },
  {
    id: "incubator-manual",
    name: "产业园 / 孵化器",
    type: "incubator",
    region: "cn",
    enabled: true,
    notes: "预留：园区官网名录、线下台账；discovery 待实现",
  },
  {
    id: "event-manual",
    name: "展会 / 活动名单",
    type: "event",
    region: "cn",
    enabled: true,
    notes: "预留：展会展商表、活动手册；discovery 待实现",
  },
]

const byId = new Map<string, ProjectSourceRegistryItem>(
  BUILT_IN_PROJECT_SOURCES.map((s) => [s.id, s]),
)

export function getAllProjectSources(): ProjectSourceRegistryItem[] {
  return [...BUILT_IN_PROJECT_SOURCES]
}

export function getEnabledProjectSources(): ProjectSourceRegistryItem[] {
  return BUILT_IN_PROJECT_SOURCES.filter((s) => s.enabled)
}

export function getProjectSourceById(id: string): ProjectSourceRegistryItem | undefined {
  return byId.get(id)
}

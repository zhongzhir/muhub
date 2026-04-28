/**
 * 将 ImportCandidate 转为创建项目 Server Action 使用的 FormData。
 * V1.1：与 app/dashboard/projects/new/actions 的字段约定对齐；后续接正式仓储时只需替换调用链末端。
 */

import { parseRepoUrl } from "@/lib/repo-platform"
import { parseProjectSourceUrl } from "@/lib/project-source-url"
import type { ImportCandidate } from "./import-types"

/** 宽松 URL：无协议时补 https://；与创建页校验策略一致 */
export function normalizeExternalProjectUrl(raw: string): { ok: true; href: string } | { ok: false; message: string } {
  const t = raw.trim()
  if (!t) {
    return { ok: false, message: "请填写项目链接" }
  }
  try {
    return { ok: true, href: new URL(t).href }
  } catch {
    try {
      return { ok: true, href: new URL(`https://${t}`).href }
    } catch {
      return { ok: false, message: "链接格式无效，请使用以 http(s):// 开头的地址，或省略协议由系统自动补全" }
    }
  }
}

/** 逗号 / 中文逗号分隔 → 去空去重 */
export function parseTagsInput(raw: string): string[] {
  const parts = raw
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(parts)].slice(0, 64)
}

/**
 * 构建传给 createProject 的 FormData。
 * - creationSource: import → 写库 sourceType=import，便于 AI 补全标签等既有逻辑
 * - 代码仓链接写入 githubUrl / giteeUrl，否则写入 websiteUrl
 */
export function importCandidateToCreateProjectFormData(candidate: ImportCandidate): FormData {
  const fd = new FormData()
  fd.set("name", candidate.name)
  fd.set("creationSource", "import")
  if (candidate.description?.trim()) {
    fd.set("description", candidate.description.trim())
  }
  if (candidate.tags?.length) {
    fd.set("tags", candidate.tags.join(","))
  }
  fd.set("growthSourceId", candidate.sourceId)
  if (candidate.notes?.trim()) {
    fd.set("importNotes", candidate.notes.trim())
  }

  /** 调用方应已通过 normalizeExternalProjectUrl 校验；此处仅按宿主分类写入表单字段 */
  const urlRaw = candidate.url?.trim()
  if (urlRaw) {
    const href = urlRaw
    const repo = parseRepoUrl(href)
    if (repo?.platform === "github") {
      fd.set("githubUrl", href)
    } else if (repo?.platform === "gitee") {
      fd.set("giteeUrl", href)
    } else {
      const source = parseProjectSourceUrl(href)
      if (source?.type === "GITCC") {
        fd.set("extraSourcesJson", JSON.stringify([{ kind: "OTHER", url: source.url, label: "GitCC" }]))
      } else {
        fd.set("websiteUrl", href)
      }
    }
  }

  return fd
}

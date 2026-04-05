/**
 * 异构输入 → ContentOpportunity（V1）。
 * 保留 mapDiscoveredProjectToContentInput 供发现侧弱耦合使用。
 */

import { randomBytes } from "crypto"

import type { DiscoveredProject } from "../types"
import type {
  ContentEvidenceItem,
  ContentOpportunity,
  ContentOpportunitySourceType,
  ContentOpportunityType,
  ContentProjectInput,
} from "./content-types"

export class ContentOpportunityValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ContentOpportunityValidationError"
  }
}

export function newContentOpportunityId(): string {
  return `opp-${Date.now()}-${randomBytes(3).toString("hex")}`
}

export function mapDiscoveredProjectToContentInput(d: DiscoveredProject): ContentProjectInput {
  const out: ContentProjectInput = {
    name: d.name,
    description: d.description,
    tags: d.tags,
    sourceType: d.sourceType,
  }
  const u = d.url?.trim()
  if (!u) {
    return out
  }
  if (/github\.com/i.test(u)) {
    out.githubUrl = u
  } else {
    out.websiteUrl = u
  }
  return out
}

function nonEmpty(name: string, v: string | undefined): string {
  const s = v?.trim() ?? ""
  if (!s) {
    throw new ContentOpportunityValidationError(`缺少必填字段：${name}`)
  }
  return s
}

function requireProjectsMin(refs: ContentProjectInput[], min: number, ctx: string): void {
  if (refs.length < min) {
    throw new ContentOpportunityValidationError(`${ctx}至少需要 ${min} 个项目引用，当前 ${refs.length}`)
  }
}

function optionalTopicTags(refs: ContentProjectInput[]): string[] {
  const tags = new Set<string>()
  for (const p of refs) {
    for (const t of p.tags ?? []) {
      const k = t.trim()
      if (k) {
        tags.add(k)
      }
    }
  }
  return [...tags].slice(0, 12)
}

/** 单项目 Spotlight → ContentOpportunity */
export function mapProjectSpotlightInput(input: {
  sourceType?: ContentOpportunitySourceType
  title?: string
  summary?: string
  project: ContentProjectInput
  evidence?: ContentEvidenceItem[]
  topicRefs?: string[]
  priority?: ContentOpportunity["priority"]
  freshness?: ContentOpportunity["freshness"]
  language?: ContentOpportunity["language"]
  id?: string
}): ContentOpportunity {
  nonEmpty("project.name", input.project.name)
  requireProjectsMin([input.project], 1, "project_spotlight")

  const name = input.project.name.trim()
  const title = input.title?.trim() || `项目 Spotlight：${name}`
  const summary =
    input.summary?.trim() ||
    input.project.tagline?.trim() ||
    input.project.description?.trim()?.slice(0, 160) ||
    `基于公开信息的单项目速览草稿（${name}）。`

  return {
    id: input.id ?? newContentOpportunityId(),
    type: "project_spotlight",
    sourceType: input.sourceType ?? "manual",
    title,
    summary,
    projectRefs: [input.project],
    topicRefs: input.topicRefs?.length ? input.topicRefs : optionalTopicTags([input.project]),
    evidence: input.evidence ?? [],
    priority: input.priority ?? "normal",
    freshness: input.freshness ?? "current",
    language: input.language ?? "zh-CN",
    createdAt: new Date().toISOString(),
  }
}

/** 多项目更新汇总 → ContentOpportunity */
export function mapProjectUpdateRoundupInput(input: {
  sourceType?: ContentOpportunitySourceType
  title?: string
  summary?: string
  projects: ContentProjectInput[]
  evidence?: ContentEvidenceItem[]
  topicRefs?: string[]
  priority?: ContentOpportunity["priority"]
  freshness?: ContentOpportunity["freshness"]
  language?: ContentOpportunity["language"]
  timeWindowNote?: string
  id?: string
}): ContentOpportunity {
  requireProjectsMin(input.projects, 2, "project_update_roundup")
  for (const p of input.projects) {
    nonEmpty("project.name", p.name)
  }

  const n = input.projects.length
  const title = input.title?.trim() || `项目更新汇总 · ${n} 则`
  const summary =
    input.summary?.trim() ||
    `本期整理 ${n} 个项目要点，用于内部周报或社群短讯。${input.timeWindowNote ? `（${input.timeWindowNote}）` : ""}`

  return {
    id: input.id ?? newContentOpportunityId(),
    type: "project_update_roundup",
    sourceType: input.sourceType ?? "manual",
    title,
    summary,
    projectRefs: input.projects,
    topicRefs: input.topicRefs?.length ? input.topicRefs : optionalTopicTags(input.projects),
    evidence: input.evidence ?? [],
    priority: input.priority ?? "normal",
    freshness: input.freshness ?? "current",
    language: input.language ?? "zh-CN",
    createdAt: new Date().toISOString(),
  }
}

/** 周报 / Digest → ContentOpportunity */
export function mapWeeklyDigestInput(input: {
  sourceType?: ContentOpportunitySourceType
  title?: string
  summary?: string
  projects: ContentProjectInput[]
  evidence?: ContentEvidenceItem[]
  topicRefs?: string[]
  priority?: ContentOpportunity["priority"]
  freshness?: ContentOpportunity["freshness"]
  language?: ContentOpportunity["language"]
  id?: string
}): ContentOpportunity {
  requireProjectsMin(input.projects, 1, "weekly_digest")
  for (const p of input.projects) {
    nonEmpty("project.name", p.name)
  }

  const n = input.projects.length
  const title = input.title?.trim() || `周报 Digest · 本期样本 ${n} 则`
  const summary =
    input.summary?.trim() || `本周固定栏目素材草稿，基于当前 ${n} 个项目条目拼装；发布前请统一校对时间与链接。`

  return {
    id: input.id ?? newContentOpportunityId(),
    type: "weekly_digest",
    sourceType: input.sourceType ?? "scheduler",
    title,
    summary,
    projectRefs: input.projects,
    topicRefs: input.topicRefs?.length ? input.topicRefs : optionalTopicTags(input.projects),
    evidence: input.evidence ?? [],
    priority: input.priority ?? "normal",
    freshness: input.freshness ?? "current",
    language: input.language ?? "zh-CN",
    createdAt: new Date().toISOString(),
  }
}

/** 手工主题 → ContentOpportunity */
export function mapManualTopicInput(input: {
  sourceType?: ContentOpportunitySourceType
  title: string
  summary: string
  narrativeHint?: string
  projects?: ContentProjectInput[]
  evidence?: ContentEvidenceItem[]
  topicRefs?: string[]
  priority?: ContentOpportunity["priority"]
  freshness?: ContentOpportunity["freshness"]
  language?: ContentOpportunity["language"]
  id?: string
}): ContentOpportunity {
  const title = nonEmpty("title", input.title)
  const summary = nonEmpty("summary", input.summary)
  const projects = input.projects ?? []
  for (const p of projects) {
    nonEmpty("project.name", p.name)
  }

  const hasEvidence = (input.evidence?.length ?? 0) > 0
  if (projects.length === 0 && !hasEvidence && summary.length < 24) {
    throw new ContentOpportunityValidationError(
      "manual_topic：无项目样本时，summary 需至少 24 字以承载命题要点，或提供 evidence / projectRefs",
    )
  }

  return {
    id: input.id ?? newContentOpportunityId(),
    type: "manual_topic",
    sourceType: input.sourceType ?? "manual",
    title: title.trim(),
    summary: summary.trim(),
    projectRefs: projects,
    topicRefs: input.topicRefs ?? optionalTopicTags(projects),
    evidence: input.evidence ?? [],
    priority: input.priority ?? "normal",
    freshness: input.freshness ?? "current",
    language: input.language ?? "zh-CN",
    createdAt: new Date().toISOString(),
  }
}

/** 将已在应用层组装好的机会做一致性校验（供 HTTP 入口等复用） */
export function assertValidContentOpportunity(op: ContentOpportunity): void {
  nonEmpty("id", op.id)
  nonEmpty("title", op.title)
  nonEmpty("summary", op.summary)
  const types: ContentOpportunityType[] = [
    "project_spotlight",
    "project_update_roundup",
    "weekly_digest",
    "manual_topic",
  ]
  if (!types.includes(op.type)) {
    throw new ContentOpportunityValidationError(`未知 opportunity.type：${op.type}`)
  }

  switch (op.type) {
    case "project_spotlight":
      requireProjectsMin(op.projectRefs, 1, "project_spotlight")
      break
    case "project_update_roundup":
      requireProjectsMin(op.projectRefs, 2, "project_update_roundup")
      break
    case "weekly_digest":
      requireProjectsMin(op.projectRefs, 1, "weekly_digest")
      break
    case "manual_topic": {
      const hasEv = (op.evidence?.length ?? 0) > 0
      if (op.projectRefs.length === 0 && !hasEv && op.summary.trim().length < 24) {
        throw new ContentOpportunityValidationError("manual_topic：请提供项目样本、证据或更长摘要")
      }
      break
    }
    default:
      break
  }
}

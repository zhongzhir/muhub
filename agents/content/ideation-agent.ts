/**
 * Content Ideation Agent V1：基于规则从项目动态、站内内容、周期与手工主题生成创意清单。
 * 不调用 LLM，不做项目价值判断或推荐排序。
 */

import { randomBytes } from "crypto"

import type { SiteContent } from "@/agents/growth/launch-plan-types"

import type { ContentIdea, ContentIdeaSourceType } from "./ideation-types"

/** 项目侧已进入系统的公开动态信号（由调用方提供顺序；Agent 不重新排序「好坏」） */
export type IdeationProjectUpdateSignal = {
  projectSlug: string
  projectName: string
  /** 最近一条可见标题，若无则省略 */
  recentUpdateTitle?: string
  /** 已登记的动态条数（≥1 时本信号有效） */
  updateCount: number
}

export type IdeationContext = {
  /** 周期规则参考时间（ISO）；用于 weekly_digest 文案中的日期窗说明 */
  asOf?: string
  /** 存在动态的项目列表；顺序由调用方决定，Agent 按出现先后取前若干个 */
  projectsWithUpdates?: IdeationProjectUpdateSignal[]
  /** 已发布站内内容，建议传入 publishedAt DESC */
  siteContent?: SiteContent[]
  /** 手工主题一行；非空时生成 topic_watch */
  manualTopic?: string
}

export type IdeationOptions = {
  /** 单次产出上限，默认 5 */
  maxIdeas?: number
  /** 是否包含周期性 weekly_digest，默认 true */
  includeWeeklyDigest?: boolean
  /** 从项目信号中最多采样的项目数，默认 2 */
  maxProjectIdeas?: number
  /** 从站内内容中最多生成的 followup 条数，默认 2 */
  maxFollowups?: number
}

function newIdeaId(seed: string): string {
  return `idea-${seed}-${randomBytes(4).toString("hex")}`
}

function dateLabelFromIso(iso: string | undefined): string {
  const s = iso?.trim()
  if (s && s.length >= 10) {
    return s.slice(0, 10)
  }
  return new Date().toISOString().slice(0, 10)
}

function newIdea(
  seed: string,
  fields: {
    ideaType: ContentIdea["ideaType"]
    title: string
    summary: string
    sourceType: ContentIdeaSourceType
    projectSlugs?: string[]
    relatedContentIds?: string[]
    evidence?: string[]
  },
): ContentIdea {
  const now = new Date().toISOString()
  return {
    id: newIdeaId(seed),
    ideaType: fields.ideaType,
    title: fields.title,
    summary: fields.summary,
    sourceType: fields.sourceType,
    projectSlugs: fields.projectSlugs,
    relatedContentIds: fields.relatedContentIds,
    evidence: fields.evidence,
    priority: 0,
    status: "new",
    createdAt: now,
  }
}

function weeklyDigestIdea(asOf: string | undefined, idx: number): ContentIdea {
  const label = dateLabelFromIso(asOf)
  return newIdea(`wd-${idx}`, {
    ideaType: "weekly_digest",
    title: `周更素材窗 · ${label}`,
    summary:
      `按固定周期整理截至 ${label} 可纳入周报 / Digest 编排的素材列表。仅罗列时间与来源维度，不做热度或项目优劣判断。`,
    sourceType: "mixed",
    evidence: ["rule:weekly_digest", `cutoff:${label}`, "ordering:input_order_only"],
  })
}

function projectIdeaFromSignal(sig: IdeationProjectUpdateSignal, index: number): ContentIdea {
  const slug = sig.projectSlug.trim()
  const name = sig.projectName.trim() || slug
  const n = sig.updateCount
  const titleHint = sig.recentUpdateTitle?.trim()

  if (n >= 2) {
    return newIdea(`pur-${slug}-${index}`, {
      ideaType: "project_update_roundup",
      title: `动态汇总候选：「${name}」`,
      summary:
        `项目「${name}」当前在系统内登记有 ${n} 条公开动态，可编排为一篇中性汇总稿，按时间或来源并列呈现事实，不作投资建议。`,
      sourceType: "project_update",
      projectSlugs: [slug],
      evidence: [
        "source:project_update",
        `slug:${slug}`,
        `updateCount:${n}`,
        titleHint ? `latestTitle:${titleHint.slice(0, 80)}` : "latestTitle:unknown",
      ],
    })
  }

  return newIdea(`ps-${slug}-${index}`, {
    ideaType: "project_spotlight",
    title: `聚焦稿候选：「${name}」`,
    summary:
      `基于项目「${name}」已登记的公开动态，可写一篇「spotlight」向说明稿，仅整理可查事实与公开描述，不评价项目价值。`,
    sourceType: "project_update",
    projectSlugs: [slug],
    evidence: [
      "source:project_update",
      `slug:${slug}`,
      `updateCount:${n}`,
      titleHint ? `latestTitle:${titleHint.slice(0, 80)}` : "latestTitle:unknown",
    ],
  })
}

function followupFromContent(row: SiteContent, index: number): ContentIdea {
  const rawTitle = row.title.trim()
  const short = rawTitle.length > 80 ? `${rawTitle.slice(0, 80)}…` : rawTitle
  return newIdea(`fu-${row.id}-${index}`, {
    ideaType: "followup_topic",
    title: `后续观察：${short}`,
    summary:
      `已存在站内发布《${short}》。可规划一篇后续短文：澄清范围、补充时间线或列出待核实问题；不改变原稿事实陈述，不构成新的推荐或评级。`,
    sourceType: "site_content",
    relatedContentIds: [row.id],
    projectSlugs: row.relatedProjectIds?.length ? [...row.relatedProjectIds] : undefined,
    evidence: [
      "source:site_content",
      `siteContentId:${row.id}`,
      `contentType:${row.contentType}`,
      `publishedAt:${row.publishedAt}`,
    ],
  })
}

function topicWatchFromManual(topic: string, index: number): ContentIdea {
  const t = topic.trim()
  return newIdea(`tw-${index}`, {
    ideaType: "topic_watch",
    title: `主题观察占位：${t.slice(0, 60)}${t.length > 60 ? "…" : ""}`,
    summary:
      `人工输入主题「${t}」。可作为「观察向」稿件种子；须由编辑补充信源、时间与边界说明。本条目不构成话题重要性判断或投资含义。`,
    sourceType: "manual_topic",
    evidence: ["source:manual_topic", `topic:${t.slice(0, 120)}`],
  })
}

/**
 * 根据上下文生成 2～5 条（若输入不足则可能更少）ContentIdea。
 * 产出顺序：周期 digest → 项目信号（按输入顺序截断）→ 站内 followup → 手工 topic。
 */
export function runIdeationAgent(ctx: IdeationContext, opts?: IdeationOptions): ContentIdea[] {
  const maxIdeas = opts?.maxIdeas ?? 5
  const includeWeeklyDigest = opts?.includeWeeklyDigest !== false
  const maxProjectIdeas = opts?.maxProjectIdeas ?? 2
  const maxFollowups = opts?.maxFollowups ?? 2

  const out: ContentIdea[] = []
  let seq = 0

  if (includeWeeklyDigest) {
    out.push(weeklyDigestIdea(ctx.asOf, seq))
    seq += 1
  }

  const projectSignals = (ctx.projectsWithUpdates ?? []).filter((s) => s.updateCount > 0 && s.projectSlug.trim())
  for (let i = 0; i < Math.min(maxProjectIdeas, projectSignals.length); i += 1) {
    out.push(projectIdeaFromSignal(projectSignals[i], i))
  }

  const contents = ctx.siteContent ?? []
  for (let i = 0; i < Math.min(maxFollowups, contents.length); i += 1) {
    out.push(followupFromContent(contents[i], i))
  }

  const manual = ctx.manualTopic?.trim()
  if (manual) {
    out.push(topicWatchFromManual(manual, seq))
  }

  return out.slice(0, Math.max(maxIdeas, 0))
}

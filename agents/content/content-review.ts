/**
 * Content Agent V1：规则层质检与草稿状态回写。
 * 非事实核查系统；不涉及外部知识库校验。
 */

import type { ContentDraft, ContentOpportunity } from "./content-types"

export type ContentReviewResult = {
  passed: boolean
  flags: string[]
  score: number
}

const HYPE_PATTERNS: RegExp[] = [
  /最牛逼|稳赚|暴涨|暴富|涨停|跌停|财务自由|一夜暴富/i,
  /全球第一|国内唯一|史无前例|绝对领先|100%收益|必读！|震惊！|内幕/i,
  /颠覆性|杀手级|史诗级/i,
  /买到就是赚到|闭眼入/i,
]

const INVESTMENT_PATTERNS = [/建议买入|看涨|看跌|目标价|估值\d+亿|财富密码/i]

function normalizeSnippet(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 160)
}

function criticalFailure(flags: string[]): boolean {
  return flags.some(
    (f) =>
      f.startsWith("title_") ||
      f.startsWith("body_") ||
      f === "missing_project_reference" ||
      f === "duplicate_draft" ||
      f === "investment_advice_tone",
  )
}

/**
 * 对单条草稿做规则质检；不修改入参 draft。
 */
export function reviewContentDraft(
  draft: ContentDraft,
  context: { opportunity: ContentOpportunity; siblingDrafts?: ContentDraft[] },
): ContentReviewResult {
  const flags: string[] = []
  let score = 100

  const title = draft.title?.trim() ?? ""
  if (!title) {
    flags.push("title_empty")
    score -= 40
  } else if (title.length < 4) {
    flags.push("title_too_short")
    score -= 25
  }

  const body = draft.body?.trim() ?? ""
  if (!body) {
    flags.push("body_empty")
    score -= 40
  } else if (body.length < 80) {
    flags.push("body_too_short")
    score -= 20
  }

  const names = draft.sourceProjectNames?.filter(Boolean) ?? []
  const slugs = draft.sourceProjectSlugs?.filter(Boolean) ?? []
  const opp = context.opportunity

  const needsProjects =
    opp.type === "project_spotlight" ||
    opp.type === "project_update_roundup" ||
    opp.type === "weekly_digest" ||
    (opp.type === "manual_topic" && opp.projectRefs.length > 0)

  if (needsProjects && names.length === 0 && slugs.length === 0) {
    flags.push("missing_project_reference")
    score -= 30
  }

  if (needsProjects && names.length < 1) {
    flags.push("weak_project_signal")
    score -= 10
  }

  const hasEvidenceSection = body.includes("【参考与证据占位】") || (opp.evidence?.length ?? 0) > 0
  if (body.length >= 80 && !hasEvidenceSection && opp.evidence.length === 0 && opp.type !== "manual_topic") {
    flags.push("evidence_section_recommended")
    score -= 5
  }

  for (const re of HYPE_PATTERNS) {
    if (re.test(title) || re.test(body)) {
      flags.push("marketing_hype_detected")
      score -= 15
      break
    }
  }

  for (const re of INVESTMENT_PATTERNS) {
    if (re.test(body) || re.test(title)) {
      flags.push("investment_advice_tone")
      score -= 25
      break
    }
  }

  const sibs = context.siblingDrafts ?? []
  for (const s of sibs) {
    if (s.id === draft.id) {
      continue
    }
    if (draft.opportunityId && s.opportunityId === draft.opportunityId) {
      if (normalizeSnippet(draft.title) === normalizeSnippet(s.title)) {
        flags.push("duplicate_draft")
        score -= 35
        break
      }
      if (normalizeSnippet(draft.body) === normalizeSnippet(s.body)) {
        flags.push("duplicate_draft")
        score -= 35
        break
      }
    }
  }

  score = Math.max(0, Math.min(100, score))

  const failed = criticalFailure(flags) || score < 55

  return {
    passed: !failed,
    flags,
    score,
  }
}

/** 将质检结果写回草稿（返回新对象） */
export function applyReviewToDraft(draft: ContentDraft, result: ContentReviewResult): ContentDraft {
  return {
    ...draft,
    reviewFlags: result.flags,
    qualityScore: result.score,
    status: result.passed ? "review_passed" : "review_failed",
  }
}

/** 生成后、自动质检前，可将状态置为待审（可选） */
export function markDraftReviewPending(draft: ContentDraft): ContentDraft {
  if (draft.status === "created" || draft.status === "draft") {
    return { ...draft, status: "review_pending" }
  }
  return draft
}

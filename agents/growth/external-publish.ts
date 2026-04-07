/**
 * 由已发布 SiteContent 生成外发帖文案（确定性规则，不调用外站 API / LLM）。
 */

import { absoluteUrl } from "@/lib/seo/site"

import type { SiteContent } from "./launch-plan-types"
import type { ExternalPostPayload, ExternalPublishChannel } from "./external-publish-types"

function stripAndTruncateMarkdownish(text: string, max: number): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (plain.length <= max) {
    return plain
  }
  return `${plain.slice(0, max - 1)}…`
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) {
    return t
  }
  return `${t.slice(0, max - 1)}…`
}

function pickSummary(content: SiteContent, maxLen: number): string {
  const s = content.summary?.trim()
  if (s) {
    return truncate(s, maxLen)
  }
  return stripAndTruncateMarkdownish(content.body ?? "", maxLen)
}

function hashtagTokenFromSlug(slug: string): string | null {
  const t = slug.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "")
  if (!t) {
    return null
  }
  return t.replace(/^#+/, "")
}

function buildHashtagTokens(content: SiteContent, channel: ExternalPublishChannel): string[] {
  const tags: string[] = ["MUHUB"]
  const seen = new Set<string>(["MUHUB"])
  for (const slug of content.relatedProjectIds ?? []) {
    const token = hashtagTokenFromSlug(slug)
    if (token && !seen.has(token)) {
      seen.add(token)
      tags.push(token)
    }
  }
  if (channel === "twitter") {
    return tags.slice(0, 4)
  }
  return tags
}

function hashLine(tokens: string[]): string {
  return tokens.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
}

/** 按渠道拼接剪贴板正文（结构不同，均为中性陈述、无自动发帖） */
export function formatExternalPostForClipboard(
  payload: ExternalPostPayload,
  channel: ExternalPublishChannel = "generic",
): string {
  const tags = hashLine(payload.hashtags)

  switch (channel) {
    case "twitter":
      return `${payload.title}\n${payload.summary}\n\n${payload.url}\n\n${tags}`

    case "linkedin": {
      const disclaimer =
        "以下摘自本站已公开发布素材，便于职业场景转发；不含项目评级、投资建议或背书。"
      return `${payload.title}\n\n${disclaimer}\n\n${payload.summary}\n\n链接：${payload.url}\n\n${tags}`
    }

    default:
      return `${payload.title}\n\n${payload.summary}\n\n${payload.url}\n\n${tags}`
  }
}

const SUMMARY_MAX: Record<ExternalPublishChannel, number> = {
  generic: 360,
  twitter: 220,
  linkedin: 720,
}

const TITLE_MAX: Record<ExternalPublishChannel, number> = {
  generic: 500,
  twitter: 100,
  linkedin: 500,
}

/**
 * 按渠道调整标题/摘要长度与标签数量；仍可手动编辑后复制。
 */
export function generateExternalPost(
  content: SiteContent,
  channel: ExternalPublishChannel = "generic",
): ExternalPostPayload {
  const title = truncate(content.title.trim(), TITLE_MAX[channel])
  const summary = pickSummary(content, SUMMARY_MAX[channel])
  const url = absoluteUrl(`/content#${content.id}`)
  const hashtags = buildHashtagTokens(content, channel)
  return { title, summary, url, hashtags }
}

/** UI / Server Action 校验用 */
export const EXTERNAL_PUBLISH_CHANNELS: ExternalPublishChannel[] = ["generic", "twitter", "linkedin"]

export function parseExternalPublishChannel(raw: string | undefined | null): ExternalPublishChannel | null {
  const t = raw?.trim().toLowerCase()
  if (t === "generic" || t === "twitter" || t === "linkedin") {
    return t
  }
  return null
}

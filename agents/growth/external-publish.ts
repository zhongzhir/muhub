/**
 * 由已发布 SiteContent 生成外发帖文案（确定性规则，不调用外站 API / LLM）。
 */

import { absoluteUrl } from "@/lib/seo/site"

import type { SiteContent } from "./launch-plan-types"
import type { ExternalPostPayload } from "./external-publish-types"

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

function pickSummary(content: SiteContent): string {
  const s = content.summary?.trim()
  if (s) {
    return s
  }
  return stripAndTruncateMarkdownish(content.body ?? "", 360)
}

function hashtagTokenFromSlug(slug: string): string | null {
  const t = slug.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "")
  if (!t) {
    return null
  }
  return t.replace(/^#+/, "")
}

function buildHashtags(content: SiteContent): string[] {
  const tags: string[] = ["MUHUB"]
  const seen = new Set<string>(["MUHUB"])
  for (const slug of content.relatedProjectIds ?? []) {
    const token = hashtagTokenFromSlug(slug)
    if (token && !seen.has(token)) {
      seen.add(token)
      tags.push(token)
    }
  }
  return tags
}

/** 每条 tag 带 #，便于直接粘贴 X / Threads 等 */
export function formatExternalPostForClipboard(payload: ExternalPostPayload): string {
  const hashLine = payload.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
  return `${payload.title}\n\n${payload.summary}\n\n${payload.url}\n\n${hashLine}`
}

export function generateExternalPost(content: SiteContent): ExternalPostPayload {
  const title = content.title.trim()
  const summary = pickSummary(content)
  const url = absoluteUrl(`/content#${content.id}`)
  const hashtags = buildHashtags(content)
  return { title, summary, url, hashtags }
}

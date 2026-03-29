/**
 * V1.3：将 ContentDraft 规则适配为多渠道格式（不接 LLM / 不接发布 API）。
 */

import type { ContentDraft } from "@/agents/content/content-types"

const SITE = "MUHUB"
const PATH = "/projects"

function firstBodyLine(body: string): string {
  const line = body.split(/\n+/).find((l) => l.trim())?.trim() ?? ""
  return line.slice(0, 160)
}

function namesHint(draft: ContentDraft): string {
  const n = draft.sourceProjectNames?.filter(Boolean) ?? []
  return n.length ? n.slice(0, 5).join("、") : "若干国内项目"
}

/** X：短文本 + 标签；输出 3 条发帖备用稿 */
export function adaptForX(draft: ContentDraft): string[] {
  const hook = draft.summary?.trim() || firstBodyLine(draft.body)
  const tags = "#AI #BuildInPublic #ChinaTech"
  const tags2 = "#开源 #产品 #MUHUB"

  return [
    `${draft.title}\n\n${hook.slice(0, 220)}${hook.length > 220 ? "…" : ""}\n\n${tags}`,
    `本周在推进的选题：${draft.title}\n样本项目：${namesHint(draft)}（冷启动规则稿）\n\n${tags2}`,
    `${hook.slice(0, 100)}${hook.length > 100 ? "…" : ""} · 详细长文已备，转载前请人工核实链接与结论。\n${SITE} ${PATH}\n${tags}`,
  ]
}

/** 小红书：轻口语 + emoji；3 条笔记初稿 */
export function adaptForXiaohongshu(draft: ContentDraft): string[] {
  const hook = draft.summary?.trim() || firstBodyLine(draft.body)
  return [
    `家人们写了个「${draft.title}」的选题初稿✨\n适合收藏做素材库～底下来源：${namesHint(draft)}\n（运营稿，发前自己改口吻）`,
    `🔥 最近在盯国内 AI/开源项目的可以看看这篇结构：${draft.title}\n亮点是样本小、能直接拿去改写成自己的观察📝`,
    `✅ 推荐先马后看：\n${hook.slice(0, 120)}…\n完整版在内网草稿箱；对外发记得补封面图和标签哈～`,
  ]
}

/** 社群：单条转发推荐语 */
export function adaptForCommunity(draft: ContentDraft): string {
  const hook = (draft.summary ?? firstBodyLine(draft.body)).slice(0, 80)
  return `【${SITE} 冷启动稿】${draft.title}\n${hook}${hook.length >= 80 ? "…" : ""}\n欢迎转到 ${PATH} 看更多项目（人工校对后发出）`
}

/** 微信公众号：标题 + 摘要（卡片级） */
export function adaptForWechat(draft: ContentDraft): { title: string; summary: string } {
  const summary =
    draft.summary?.trim() ||
    firstBodyLine(draft.body) ||
    draft.body.replace(/\s+/g, " ").slice(0, 200)
  return {
    title: draft.title,
    summary: summary.slice(0, 500),
  }
}

/** 由公众号卡片衍生 3 条朋友圈/群转发短话术 */
export function wechatMomentsFromOfficialCard(
  draft: ContentDraft,
  card: { title: string; summary: string },
): string[] {
  return [
    `📰 ${card.title}\n${card.summary.slice(0, 200)}${card.summary.length > 200 ? "…" : ""}`,
    `转需｜${card.title}\n要点：${card.summary.slice(0, 120)}…\n原文已备，发前按品牌口径润色`,
    `「${draft.type}」选题 · ${card.title}\n${card.summary.slice(0, 100)}…\n更多项目 ${SITE} ${PATH}`,
  ]
}

/**
 * V1.2：规则化模板文案（不接 LLM）。
 * 后续可将本模块替换为「LLM 提示 + 本文件作为 fallback」。
 */

import type {
  ColdStartRoundupThemeId,
  ContentChannel,
  ContentDraftType,
  ContentProjectInput,
} from "./content-types"

const SITE_NAME = "MUHUB"
/** 站内项目列表路径，避免硬编码域名 */
const PROJECTS_PATH = "/projects"

/** 标准行动号召单行，供草稿 cta 字段与正文尾部复用 */
export function defaultMuHubCta(): string {
  return `欢迎到 ${SITE_NAME} 项目广场浏览更多资料与动态：${PROJECTS_PATH}`
}

export function formatProjectOneLiner(p: ContentProjectInput): string {
  const parts: string[] = [p.name]
  if (p.tagline?.trim()) {
    parts.push(`——${p.tagline.trim()}`)
  } else if (p.description?.trim()) {
    const d = p.description.trim().replace(/\s+/g, " ")
    parts.push(`：${d.slice(0, 120)}${d.length > 120 ? "…" : ""}`)
  }
  return parts.join("")
}

export function collectTagFrequency(projects: ContentProjectInput[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of projects) {
    for (const t of p.tags ?? []) {
      const k = t.trim()
      if (!k) {
        continue
      }
      m.set(k, (m.get(k) ?? 0) + 1)
    }
  }
  return m
}

function roundupTitle(theme: ColdStartRoundupThemeId, count: number): string {
  switch (theme) {
    case "today-ai-five":
      return `今日发现 ${Math.min(count, 5)} 个值得关注的 AI 项目`
    case "weekly-cn-ai-opensource":
      return "本周值得关注的中国 AI / 开源项目"
    case "interesting-domestic-picks":
      return "最近看到的几个有意思的国内项目"
    default:
      return `项目推荐汇总 · ${count} 则`
  }
}

function ctaBlock(): string {
  return ["——", defaultMuHubCta(), "（本文为运营草稿，发布前请按渠道规范校对与调整。）"].join("\n")
}

/** project-roundup：导语 + 分项 + CTA */
export function buildProjectRoundupBody(
  projects: ContentProjectInput[],
  theme: ColdStartRoundupThemeId,
): { title: string; summary: string; body: string } {
  const n = projects.length
  const title = roundupTitle(theme, n)
  const intro =
    theme === "interesting-domestic-picks"
      ? "最近在社群和仓库里刷到一批国内团队仍在认真迭代的产品与开源仓库，先整理一版供内部冷启动与转载选用。样本有限，仅作选题参考。"
      : theme === "weekly-cn-ai-opensource"
        ? "本周筛了一轮中国背景或可被中国用户直接使用的 AI 与开源相关项目，偏工程落地与社区热度。以下为基于当前样本的汇总稿。"
        : "下面这篇是基于当前输入样本自动拼装的推荐汇总稿，适合公众号/社群长图文的初稿。请投放前人工润色与核实链接。"

  const bullets = projects
    .map((p, i) => {
      const lines: string[] = [`【${i + 1}】${p.name}`]
      if (p.tagline?.trim()) {
        lines.push(`一句话：${p.tagline.trim()}`)
      }
      if (p.description?.trim()) {
        lines.push(p.description.trim().split(/\n+/)[0]!.slice(0, 280))
      }
      const links: string[] = []
      if (p.websiteUrl?.trim()) {
        links.push(`官网：${p.websiteUrl.trim()}`)
      }
      if (p.githubUrl?.trim()) {
        links.push(`仓库：${p.githubUrl.trim()}`)
      }
      if (p.tags?.length) {
        lines.push(`标签：${p.tags.slice(0, 8).join("、")}`)
      }
      if (links.length) {
        lines.push(links.join(" ｜ "))
      }
      return lines.join("\n")
    })
    .join("\n\n")

  const body = [intro, "", bullets, "", ctaBlock()].join("\n")
  const summary = projects.map((p) => formatProjectOneLiner(p)).join("；").slice(0, 200)
  return { title, summary, body }
}

/** trend-observation：明确「基于当前样本」 */
export function buildTrendObservationBody(
  projects: ContentProjectInput[],
  extraTags?: string[],
): { title: string; summary: string; body: string } {
  const title = "从这些项目看，AI 创业正在往哪里走"
  const tagFreq = collectTagFrequency(projects)
  for (const t of extraTags ?? []) {
    const k = t.trim()
    if (k) {
      tagFreq.set(k, (tagFreq.get(k) ?? 0) + 1)
    }
  }
  const topTags = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k)

  const names = projects.map((p) => p.name).join("、")

  const trendLines: string[] = [
    "【说明】以下为基于当前样本的标签与项目简介所做的规则归纳，并非全市场结论，投放时请改为「我们观察到」类表述并补充论据。",
    "",
    `当前样本涉及项目（${projects.length} 个）：${names || "（空）"}`,
  ]

  if (topTags.length) {
    trendLines.push("", `样本中反复出现的能力/主题关键词：${topTags.join("、")}`)
    trendLines.push(
      "· 趋势线索 1：工程侧更强调「可落地场景 + 可验证指标」，纯概念型描述在样本里占比偏低（基于简介关键词粗略判断）。",
      "· 趋势线索 2：开源/仓库链接与官网并列出现在的项目更常见，便于二次传播与开发者接入。",
    )
    if (topTags.length >= 2) {
      trendLines.push(
        `· 趋势线索 3：与「${topTags[0]}」相关的项目在样本中较集中，可作垂直选题（如「${topTags[0]} 在国内的落地案例」）。`,
      )
    }
    if (topTags.length >= 3) {
      trendLines.push(
        `· 趋势线索 4：「${topTags[1]}」「${topTags[2]}」组合值得单独拆一篇趋势观察（样本归纳，非预测）。`,
      )
    }
  } else {
    trendLines.push(
      "",
      "· 当前样本标签较少，建议下一轮先补充项目的 tags 或简介，再生成趋势稿。",
      "· 可手写 2～4 条观察作为补段，避免空稿。",
    )
  }

  trendLines.push("", ctaBlock())
  const body = trendLines.join("\n")
  const summary = `基于 ${projects.length} 个项目的样本归纳；关键词：${topTags.join("、") || "（无）"}`.slice(0, 200)
  return { title, summary, body }
}

/** project-spotlight：速览体 */
export function buildProjectSpotlightBody(p: ContentProjectInput): {
  title: string
  summary: string
  body: string
} {
  const title = `项目速览：${p.name} 为什么值得关注`
  const why =
    p.tagline?.trim() ||
    p.description?.trim()?.slice(0, 400) ||
    "（建议补充一句话定位或简介后再发对外稿。）"
  const body = [
    `本篇为单项目解读草稿，渠道可选用公众号短文、社群长消息或卡片文案。`,
    "",
    `【项目是做什么的】`,
    why,
    "",
    `【为什么值得关注】`,
    `- 样本内可见的公开信息：${p.githubUrl ? "有仓库链接，便于开发者跟进；" : ""}${p.websiteUrl ? "有官网，便于了解产品形态；" : ""}`,
    `- 若面向国内用户，可补充：团队背景、合规与数据路径、落地客户案例（需人工核实后写入）。`,
    "",
    `【你可以怎么跟进】`,
    p.websiteUrl?.trim() ? `官网：${p.websiteUrl.trim()}` : "",
    p.githubUrl?.trim() ? `仓库：${p.githubUrl.trim()}` : "",
    `也可以到 ${SITE_NAME} 搜索或收录该项目：${PROJECTS_PATH}`,
    "",
    ctaBlock(),
  ]
    .filter(Boolean)
    .join("\n")

  const summary = formatProjectOneLiner(p).slice(0, 200)
  return { title, summary, body }
}

/** 多项目「更新」汇总：强调近期变更与样本边界，不单篇深挖 */
export function buildProjectUpdateRoundupBody(
  projects: ContentProjectInput[],
  opts?: { windowNote?: string },
): { title: string; summary: string; body: string } {
  const n = projects.length
  const title = `项目更新摘要 · 本期 ${n} 则（样本稿）`
  const window = opts?.windowNote?.trim() || "本期时间窗由运营指定；若未填请以实际上线批次为准。"
  const intro = [
    "【说明】以下为基于当前录入的项目简介与标签拼装的内部摘要稿，用于周报或社群短讯。不构成投资建议，投放前请核对各项目官网与仓库最新状态。",
    "",
    `时间窗：${window}`,
  ].join("\n")

  const bullets = projects
    .map((p, i) => {
      const lines: string[] = [`【${i + 1}】${p.name}`]
      if (p.tagline?.trim()) {
        lines.push(`定位：${p.tagline.trim()}`)
      }
      if (p.description?.trim()) {
        lines.push(p.description.trim().split(/\n+/)[0]!.slice(0, 240))
      }
      const links: string[] = []
      if (p.websiteUrl?.trim()) {
        links.push(`官网：${p.websiteUrl.trim()}`)
      }
      if (p.githubUrl?.trim()) {
        links.push(`仓库：${p.githubUrl.trim()}`)
      }
      if (p.tags?.length) {
        lines.push(`标签：${p.tags.slice(0, 8).join("、")}`)
      }
      if (links.length) {
        lines.push(links.join(" ｜ "))
      }
      return lines.join("\n")
    })
    .join("\n\n")

  const body = [intro, "", bullets, "", ctaBlock()].join("\n")
  const summary = `共 ${n} 个项目要点；${projects
    .map((p) => p.name)
    .slice(0, 4)
    .join("、")}${n > 4 ? "…" : ""}`.slice(0, 200)
  return { title, summary, body }
}

/** 周报 / Digest：在周汇总模板上叠加栏目说明与标题钩子 */
export function buildWeeklyDigestBody(
  projects: ContentProjectInput[],
  opts?: { digestTitle?: string; theme?: ColdStartRoundupThemeId },
): { title: string; summary: string; body: string } {
  const theme = opts?.theme ?? "weekly-cn-ai-opensource"
  const base = buildProjectRoundupBody(projects, theme)
  const title = opts?.digestTitle?.trim() || `周报 Digest · ${base.title}`
  const introExtra =
    "【周报体例】本节为固定栏目初稿，侧重「可转述事实 + 可追溯链接」。若某条信息偏旧，请在发布前更新或删除该条。"
  const body = [introExtra, "", base.body].join("\n")
  return { title, summary: base.summary, body }
}

/** 手工主题：以运营命题为主，可挂靠少量项目样本 */
export function buildManualTopicBody(
  opts: { title: string; summary: string; narrativeHint?: string; projects?: ContentProjectInput[] },
): { title: string; summary: string; body: string } {
  const projects = opts.projects ?? []
  const narrative =
    opts.narrativeHint?.trim() ||
    "（可在此补充本轮命题：读者是谁、希望传递的事实边界、需要避免的结论类型。）"
  const sample =
    projects.length > 0
      ? projects
          .map((p, i) => {
            const line = formatProjectOneLiner(p)
            return `· 样本 ${i + 1}：${line}`
          })
          .join("\n")
      : "· 当前未挂载具体项目样本；若命题与站内项目相关，请补充 projectRefs 后再生成一版。"

  const body = [
    `【手工主题】${opts.title}`,
    "",
    "【本篇想讲清楚的事】",
    narrative,
    "",
    "【摘要】",
    opts.summary.trim(),
    "",
    "【可选样本列表（事实引用用）】",
    sample,
    "",
    ctaBlock(),
  ].join("\n")

  return { title: opts.title.trim(), summary: opts.summary.trim().slice(0, 200), body }
}

/** social-post：多版本结构；V1.2 实现 recommend 为默认完整版，其余走精简规则 */
export function buildSocialPostBody(
  projects: ContentProjectInput[],
  variant: "default" | "concise" | "recommend" | "observation",
): { title: string; summary: string; body: string } {
  const isMulti = projects.length > 1
  const title = isMulti ? `${SITE_NAME} · 项目短推（${projects.length} 则）` : `${SITE_NAME} · 短推 · ${projects[0]!.name}`

  const baseNames = projects.map((p) => p.name).join("、")
  let body: string
  switch (variant) {
    case "concise":
      body = isMulti
        ? `推几个在看的项目：${baseNames}。详情见 ${PROJECTS_PATH}`
        : `最近在盯「${projects[0]!.name}」${projects[0]!.tagline ? `：${projects[0]!.tagline}` : ""}。链接稍后补；冷启动稿仅供参考。`
      break
    case "observation":
      body = `小样本观察：${baseNames} 这批项目里，工具化与开源可跟进的占比不低（规则生成稿，非结论）。想系统性看国内新项目可走 ${PROJECTS_PATH}。`
      break
    case "recommend":
    case "default":
    default:
      body = isMulti
        ? `【推荐】最近在整理国内 AI/开源向的新项目，先抛一组名单：${baseNames}。\n适合转发到社群做「周报素材」— 具体介绍与链接建议人工补齐。\n${SITE_NAME} ${PROJECTS_PATH}`
        : `【推荐】关注「${projects[0]!.name}」${projects[0]!.tagline ? `：${projects[0]!.tagline}` : ""}。\n值得关注的原因：公开信息完整度 OK、适合作为冷启动选题；投放前请补官网/仓库与合规表述。\n${SITE_NAME} ${PROJECTS_PATH}`
      break
  }

  const summary = body.split("\n")[0]!.slice(0, 120)
  return { title, summary, body }
}

export function defaultChannelForType(type: ContentDraftType): ContentChannel {
  switch (type) {
    case "project-roundup":
    case "trend-observation":
    case "project-spotlight":
      return "wechat"
    case "social-post":
      return "community"
    default:
      return "article"
  }
}

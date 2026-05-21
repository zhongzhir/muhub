import type { Prisma } from "@prisma/client";
import { suggestAdminProjectClassificationAndTags } from "@/lib/admin-project-classify-suggest";
import { getDeepSeekClient, getDeepSeekCompatibleModel } from "@/lib/deepseek";
import { normalizeSuggestedCategories, normalizeSuggestedTags } from "@/lib/tag-normalization";
import { normalizeChineseExpression, normalizeChineseList } from "@/lib/zh-normalization";
import { buildProjectEvidenceContext, type ProjectEvidenceContext } from "@/lib/project-evidence-context";
import {
  buildProjectEvidenceSnapshot,
  buildCompressedEvidenceSnapshot,
  formatCompressedEvidenceForPrompt,
  type ProjectEvidenceSnapshot,
} from "@/lib/project-evidence-snapshot";
import {
  type WebsiteEvidenceSnapshot,
} from "@/lib/project-url-evidence";
import {
  buildProjectKnowledgeFromEvidence,
  normalizeProjectKnowledge,
  PROJECT_KNOWLEDGE_JSON_SCHEMA_EXAMPLE,
  saveProjectKnowledge,
  type ProjectKnowledge,
} from "@/lib/project-knowledge";
import { prisma } from "@/lib/prisma";

type ActivityLevel = "high" | "medium" | "low" | "unknown";

export type ProjectAIInsight = {
  version: "v1";
  summary: string;
  whatItIs: string;
  whoFor: string[];
  useCases: string[];
  highlights: string[];
  valueSignals: string[];
  activity: {
    level: ActivityLevel;
    signals: string[];
  };
  risks: string[];
  suggestions: string[];
  completeness: {
    score: number;
    existing: string[];
    missing: string[];
  };
  sourceNotes: string[];
  generatedAt: string;
  /** 出版行业适配分析（平台通用能力 V1，可选） */
  publishingSceneTags?: string[];
  publishingAnalysis?: string;
  publishingRelevance?: "high" | "medium" | "low" | "none";
};

export type ProjectAISignals = {
  github?: {
    repoUrl?: string;
    description?: string | null;
    stars?: number | null;
    forks?: number | null;
    watchers?: number | null;
    openIssues?: number | null;
    lastPushedAt?: string | null;
    language?: string | null;
    releaseCount?: number | null;
    commitSignal?: string[];
    isActive?: boolean;
    hasReleases?: boolean;
    readmeLength?: number;
  };
  website?: {
    url?: string;
    exists?: boolean;
    reachable?: boolean;
    statusCode?: number | null;
    finalUrl?: string | null;
    errorMessage?: string | null;
    title?: string | null;
    description?: string | null;
    hasContent?: boolean;
    hasKeySections?: boolean;
  };
  socials?: {
    twitter?: string | null;
    wechatOfficialAccount?: string | null;
    discord?: string | null;
    telegram?: string | null;
    linkedin?: string | null;
    youtube?: string | null;
  };
  docs?: {
    hasDocs?: boolean;
    hasDemo?: boolean;
    hasPricing?: boolean;
    hasContact?: boolean;
  };
  media?: {
    mentions?: string[];
  };
};

export type ProjectAISourceLevel = "A" | "B" | "C" | "D" | "E";

export type ProjectAISuggestedCategories = {
  primary?: string;
  secondary?: string;
  optional?: string[];
};

export type ProjectAICompleteness = {
  score: number;
  existing: string[];
  missing: string[];
  note: string;
};

export type ProjectInsightSourceSnapshot = {
  base: {
    projectId: string;
    name: string;
    tagline: string | null;
    description: string | null;
    website: string | null;
    github: string | null;
    tags: string[];
    categories: string[];
    recentActivities: Array<{ title: string; summary: string | null; occurredAt: string | null; sourceUrl: string | null }>;
  };
  github: {
    facts: ProjectAISignals["github"];
    readmeSummary: string | null;
  };
  website: {
    facts: ProjectAISignals["website"];
    evidence: WebsiteEvidenceSnapshot | null;
    hasPricing: boolean;
    hasDocs: boolean;
    hasContact: boolean;
    hasDemo: boolean;
    hasContent: boolean;
    hasKeySections: boolean;
  };
  socials: {
    accounts: Record<string, string | null>;
    exists: {
      twitter: boolean;
      discord: boolean;
      telegram: boolean;
      linkedin: boolean;
    };
  };
  extractedSignals: {
    mainSources: string[];
    missingSources: string[];
  };
  sourceContents: Array<{
    kind: string;
    label: string | null;
    title: string | null;
    url: string | null;
    summary: string | null;
    content: string | null;
  }>;
  evidenceContext: ProjectEvidenceContext | null;
  evidenceSnapshot?: ProjectEvidenceSnapshot | null;
};

type InsightGenerateResult = {
  insight: ProjectAIInsight;
  suggestedTags: string[];
  suggestedCategories: ProjectAISuggestedCategories;
  knowledge: ProjectKnowledge;
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = safeString(item);
    if (!text) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function stripMarkdownCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function limitText(text: string, max: number): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function sanitizeInsightAgainstWebsiteEvidence(
  insight: ProjectAIInsight,
  websiteEvidence: WebsiteEvidenceSnapshot | null,
): ProjectAIInsight {
  if (!websiteEvidence?.reachable) {
    return insight;
  }
  const unreachablePattern = /官网.{0,12}(无法访问|不可访问|打不开|访问失败|不能访问)/u;
  const scrub = (value: string) =>
    unreachablePattern.test(value)
      ? value.replace(unreachablePattern, "官网已验证可访问，但公开信息仍较有限")
      : value;
  return {
    ...insight,
    summary: scrub(insight.summary),
    whatItIs: scrub(insight.whatItIs),
    risks: insight.risks.map((item) => scrub(item)),
    suggestions: insight.suggestions.map((item) => scrub(item)),
    sourceNotes: insight.sourceNotes.map((item) =>
      unreachablePattern.test(item) ? "官网已通过服务端抓取验证可访问" : item,
    ),
  };
}

export async function buildProjectInsightSourceSnapshot(projectId: string): Promise<ProjectInsightSourceSnapshot | null> {
  const evidenceSnapshot = await buildProjectEvidenceSnapshot(projectId);
  if (!evidenceSnapshot) {
    return null;
  }

  const evidenceContext = await buildProjectEvidenceContext(projectId);
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      updates: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 8,
      },
    },
  });
  if (!row) {
    return null;
  }

  const websiteEvidence = evidenceSnapshot.website.evidence;
  const websiteFacts = {
    url: evidenceSnapshot.website.url ?? undefined,
    exists: evidenceSnapshot.website.reachable,
    reachable: evidenceSnapshot.website.reachable,
    statusCode: websiteEvidence?.statusCode ?? null,
    finalUrl: websiteEvidence?.finalUrl ?? null,
    errorMessage: websiteEvidence?.errorMessage ?? null,
    title: evidenceSnapshot.website.title,
    description: evidenceSnapshot.website.description,
  };
  const websiteText = `${websiteFacts.title ?? ""} ${websiteFacts.description ?? ""} ${evidenceSnapshot.website.extractedSummary ?? ""}`.toLowerCase();

  const sourceContents = evidenceSnapshot.sources.items.map((source) => ({
    kind: source.kind,
    label: source.label,
    title: source.title,
    url: source.url,
    summary: source.summary,
    content: source.contentExcerpt,
  }));

  const mainSources: string[] = [];
  if (sourceContents.some((source) => source.kind === "WECHAT_ARTICLE")) {
    mainSources.push("公众号文章");
  }
  if (evidenceContext?.official) {
    mainSources.push("人工/官方信息");
  }
  if (evidenceSnapshot.curated.markdownExcerpt) {
    mainSources.push("curated 列表");
  }
  if (evidenceSnapshot.github.url) {
    mainSources.push("GitHub");
  }
  if (evidenceSnapshot.website.url) {
    mainSources.push(evidenceSnapshot.website.reachable ? "官网（已验证可访问）" : "官网");
  }
  if (row.description?.trim() || row.tagline?.trim()) {
    mainSources.push("项目描述");
  }
  if (Object.values(evidenceSnapshot.social.accounts).some(Boolean)) {
    mainSources.push("社媒");
  }

  const missingSources = [...evidenceSnapshot.signals.missingPublicInfo];
  if (!evidenceSnapshot.github.url) {
    missingSources.push("未检测到 GitHub");
  }
  if (!evidenceSnapshot.website.url || !evidenceSnapshot.website.reachable) {
    missingSources.push("未检测到可用官网 evidence");
  }

  return {
    base: {
      projectId: row.id,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      website: evidenceSnapshot.website.url,
      github: evidenceSnapshot.github.url,
      tags: row.tags,
      categories: [row.primaryCategory, ...(Array.isArray(row.categoriesJson) ? row.categoriesJson : [])]
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim())),
      recentActivities: row.updates.map((item) => ({
        title: item.title,
        summary: item.summary,
        occurredAt: toIsoOrNull(item.occurredAt ?? item.createdAt),
        sourceUrl: item.sourceUrl ?? null,
      })),
    },
    github: {
      facts: {
        repoUrl: evidenceSnapshot.github.url ?? undefined,
        description: evidenceSnapshot.github.description,
        stars: evidenceSnapshot.github.stars,
        lastPushedAt: evidenceSnapshot.github.updatedAt,
        language: evidenceSnapshot.github.language,
        releaseCount: evidenceSnapshot.github.releaseCount,
        commitSignal: [],
        isActive: evidenceSnapshot.signals.githubActive ?? undefined,
        hasReleases: evidenceSnapshot.signals.hasReleases ?? undefined,
        readmeLength: evidenceSnapshot.github.readmeSummary?.length ?? undefined,
      },
      readmeSummary: evidenceSnapshot.github.readmeSummary,
    },
    website: {
      facts: websiteFacts,
      evidence: websiteEvidence,
      hasPricing: evidenceSnapshot.signals.websiteHasPricing,
      hasDocs: evidenceSnapshot.docs.hasDocsSignal,
      hasContact: evidenceSnapshot.signals.websiteHasContact,
      hasDemo: websiteText.includes("demo") || websiteText.includes("演示"),
      hasContent: Boolean(
        websiteFacts.description?.trim() ||
          websiteFacts.title?.trim() ||
          evidenceSnapshot.website.extractedSummary?.trim(),
      ),
      hasKeySections:
        evidenceSnapshot.signals.websiteHasPricing ||
        evidenceSnapshot.docs.hasDocsSignal ||
        evidenceSnapshot.signals.websiteHasContact,
    },
    socials: {
      accounts: evidenceSnapshot.social.accounts,
      exists: {
        twitter: Boolean(evidenceSnapshot.social.accounts.twitter),
        discord: Boolean(evidenceSnapshot.social.accounts.discord),
        telegram: Boolean(evidenceSnapshot.social.accounts.telegram),
        linkedin: Boolean(evidenceSnapshot.social.accounts.linkedin),
      },
    },
    extractedSignals: {
      mainSources,
      missingSources: [...new Set(missingSources)],
    },
    sourceContents,
    evidenceContext,
    evidenceSnapshot,
  };
}

export function computeProjectCompleteness(snapshot: ProjectInsightSourceSnapshot): ProjectAICompleteness {
  const checks: Array<{ name: string; ok: boolean; weight: number }> = [
    { name: "官网", ok: Boolean(snapshot.base.website) || Boolean(snapshot.website.evidence?.reachable), weight: 9 },
    { name: "GitHub", ok: Boolean(snapshot.base.github), weight: 9 },
    { name: "一句话介绍", ok: Boolean(snapshot.base.tagline?.trim()), weight: 9 },
    { name: "详细介绍", ok: Boolean(snapshot.base.description?.trim()), weight: 10 },
    { name: "使用场景说明", ok: Boolean(snapshot.base.description?.trim() || snapshot.sourceContents.length), weight: 9 },
    { name: "目标用户说明", ok: Boolean(snapshot.base.description?.trim() || snapshot.sourceContents.length), weight: 9 },
    {
      name: "联系方式",
      ok: Boolean(snapshot.socials.accounts.twitter || snapshot.socials.accounts.linkedin || snapshot.socials.accounts.telegram || snapshot.socials.accounts.wechatOfficialAccount),
      weight: 9,
    },
    {
      name: "文档",
      ok: Boolean(snapshot.website.hasDocs || snapshot.base.recentActivities.some((item) => item.sourceUrl?.toLowerCase().includes("doc"))),
      weight: 9,
    },
    {
      name: "Demo",
      ok: Boolean(snapshot.website.hasDemo || snapshot.base.recentActivities.some((item) => item.title.toLowerCase().includes("demo"))),
      weight: 9,
    },
    {
      name: "社媒账号",
      ok: Object.values(snapshot.socials.accounts).some(Boolean),
      weight: 9,
    },
    {
      name: "团队信息",
      ok: Boolean(snapshot.website.facts?.description?.toLowerCase().includes("team") || snapshot.base.description?.toLowerCase().includes("团队")),
      weight: 9,
    },
  ];
  const total = checks.reduce((sum, item) => sum + item.weight, 0);
  const got = checks.filter((item) => item.ok).reduce((sum, item) => sum + item.weight, 0);
  return {
    score: Math.round((got / total) * 100),
    existing: checks.filter((item) => item.ok).map((item) => item.name),
    missing: checks.filter((item) => !item.ok).map((item) => item.name),
    note: "该分数仅反映当前公开信息完整度，不代表项目质量评价。",
  };
}

function getActivityLevel(snapshot: ProjectInsightSourceSnapshot): ActivityLevel {
  const pushedAt = snapshot.github.facts?.lastPushedAt;
  if (!pushedAt) return "unknown";
  const days = Math.floor((Date.now() - new Date(pushedAt).getTime()) / (24 * 3600 * 1000));
  if (days <= 14) return "high";
  if (days <= 45) return "medium";
  return "low";
}

export function computeProjectSourceLevel(snapshot: ProjectInsightSourceSnapshot): ProjectAISourceLevel {
  const hasGithub = Boolean(snapshot.base.github);
  const hasWebsite = Boolean(snapshot.base.website);
  const hasSocial = Object.values(snapshot.socials.exists).some(Boolean);
  const hasDescription = Boolean(snapshot.base.tagline?.trim() || snapshot.base.description?.trim());
  const hasArticle = snapshot.sourceContents.some((source) => source.kind === "WECHAT_ARTICLE" && source.content?.trim());
  const hasOfficial = Boolean(snapshot.evidenceContext?.official);
  const hasExternalLinks = Boolean(snapshot.evidenceContext?.links.length);
  const hasRichSources = snapshot.sourceContents.filter((source) => source.content?.trim() || source.summary?.trim()).length >= 2;

  if ((hasArticle || hasOfficial) && (hasGithub || hasWebsite || hasExternalLinks)) return hasSocial || hasRichSources ? "A" : "B";
  if (hasArticle || hasOfficial || hasRichSources) return "B";
  if (hasGithub && hasWebsite && hasSocial) return "A";
  if (hasGithub && hasWebsite) return "B";
  if (hasWebsite || hasExternalLinks) return "C";
  if (hasGithub) return "C";
  if (hasDescription) return "D";
  return "E";
}

function ensureInsightShape(
  input: unknown,
  completeness: ProjectAICompleteness,
  fallback?: {
    suggestedCategories?: ProjectAISuggestedCategories;
    evidenceSnapshot?: ProjectEvidenceSnapshot | null;
  },
): InsightGenerateResult {
  const nowIso = new Date().toISOString();
  const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const insightObj = (obj.insight && typeof obj.insight === "object" ? obj.insight : obj) as Record<string, unknown>;
  const categoryObj =
    obj.suggestedCategories && typeof obj.suggestedCategories === "object"
      ? (obj.suggestedCategories as Record<string, unknown>)
      : {};
  const levelRaw = safeString((insightObj.activity as Record<string, unknown> | undefined)?.level);
  const level: ActivityLevel =
    levelRaw === "high" || levelRaw === "medium" || levelRaw === "low" || levelRaw === "unknown"
      ? levelRaw
      : "unknown";

  const parsed: ProjectAIInsight = {
    version: "v1",
    summary: limitText(
      normalizeChineseExpression(safeString(insightObj.summary) || "信息不足，暂无法形成清晰的一句话总结。"),
      180,
    ),
    whatItIs: limitText(
      normalizeChineseExpression(safeString(insightObj.whatItIs) || "信息不足，建议补充官网或项目文档后再生成。"),
      220,
    ),
    whoFor: normalizeChineseList(safeStringArray(insightObj.whoFor, 6)),
    useCases: normalizeChineseList(safeStringArray(insightObj.useCases, 6)),
    highlights: normalizeChineseList(safeStringArray(insightObj.highlights, 8)),
    valueSignals: normalizeChineseList(safeStringArray(insightObj.valueSignals, 8)),
    activity: {
      level,
      signals: normalizeChineseList(
        safeStringArray((insightObj.activity as Record<string, unknown> | undefined)?.signals, 6),
      ),
    },
    risks: normalizeChineseList(safeStringArray(insightObj.risks, 8)),
    suggestions: normalizeChineseList(safeStringArray(insightObj.suggestions, 8)),
    completeness: {
      score: completeness.score,
      existing: completeness.existing,
      missing: completeness.missing,
    },
    sourceNotes: normalizeChineseList(safeStringArray(insightObj.sourceNotes, 8)),
    generatedAt: safeString(insightObj.generatedAt) || nowIso,
  };

  const suggestedTags = normalizeSuggestedTags(safeStringArray(obj.suggestedTags, 8));
  const normalizedCategories = normalizeSuggestedCategories({
    primary: safeString(categoryObj.primary) || undefined,
    secondary: safeString(categoryObj.secondary) || undefined,
    optional: safeStringArray(categoryObj.optional, 5),
  });
  const suggestedCategories: ProjectAISuggestedCategories = {
    primary: normalizedCategories.primary,
    secondary: normalizedCategories.secondary,
    optional: normalizedCategories.optional,
  };

  const knowledgeRaw =
    obj.knowledge && typeof obj.knowledge === "object" ? obj.knowledge : obj;
  const knowledge = normalizeProjectKnowledge(knowledgeRaw, {
    suggestedCategories,
    evidenceSnapshot: fallback?.evidenceSnapshot,
  });

  return { insight: parsed, suggestedTags, suggestedCategories, knowledge };
}

export async function generateProjectAIInsight(
  snapshot: ProjectInsightSourceSnapshot,
  completeness: ProjectAICompleteness,
): Promise<InsightGenerateResult> {
  const client = getDeepSeekClient();
  const model = getDeepSeekCompatibleModel("DEEPSEEK_MODEL_INSIGHT");
  const fallbackSuggest = suggestAdminProjectClassificationAndTags({
    githubUrl: snapshot.base.github ?? "",
    tagline: snapshot.base.tagline ?? "",
    description: snapshot.base.description ?? "",
    name: snapshot.base.name,
    websiteUrl: snapshot.base.website ?? "",
    aiCardSummary: "",
    evidenceContext: snapshot.evidenceContext?.promptText ?? "",
  });
  const systemPrompt = [
    "你是 MUHUB 的项目公开信息整理助手。",
    "你的任务不是评价项目优劣，也不是给投资建议，而是把项目公开信息整理为结构化中文认知卡。",
    "只能依据输入 evidence 整理，不得编造不存在的事实。",
    "不得输出“值得投资”“行业领先”“前景巨大”“强烈推荐”等武断结论。",
    "仅当 evidence 显示 GitHub 与官网均 missing、且 curated/其他来源 coverage 也低时，才在 sourceNotes 中说明「当前公开信息有限」。",
    "若官网 coverage 为 full/partial，或 curated coverage 为 full，或存在 docs/social/product 来源，应表述为「当前资料主要来自官网与公开收录来源」，不要无根据说公开信息有限。",
    "如果 evidence 中 website fetchedEvidence 显示 reachable=true，禁止声称官网无法访问、打不开或不可访问。",
    "如果页面是 JS 动态渲染导致正文较少，应表述为“公开静态信息有限”，而不是“官网无法访问”。",
    "sourceNotes 需要明确标注信息来源类型（例如 GitHub / 官网抓取证据 / 项目描述 / curated 列表），并指出缺失来源。",
    "必须区分“来源存在”和“来源有效”：例如官网可访问但内容较少、GitHub 存在但长期不活跃。",
    "若 GitHub 超过 90 天无更新、README 过短或官网缺少关键栏目，应在 risks/suggestions/sourceNotes 中明确提示。",
    "输出必须是合法 json，不要输出 markdown。",
    "你必须输出 json。",
  ].join("\n");
  const evidencePrompt = snapshot.evidenceSnapshot
    ? formatCompressedEvidenceForPrompt(
        buildCompressedEvidenceSnapshot(snapshot.evidenceSnapshot),
      )
    : snapshot.evidenceContext?.promptText ?? "";
  const sourceContext = snapshot.sourceContents
    .map((source, index) => {
      const sourceName =
        source.kind === "WECHAT_ARTICLE"
          ? "公众号"
          : source.label?.trim() || source.kind;
      const contentExcerpt = source.content
        ? limitText(source.content, source.label?.includes("curated_repository") ? 360 : 200)
        : null;
      return [
        `【来源${index + 1}：${sourceName}】`,
        source.title ? `标题：${limitText(source.title, 120)}` : null,
        source.url ? `链接：${source.url}` : null,
        source.summary ? `摘要：${limitText(source.summary, 160)}` : null,
        contentExcerpt ? `正文摘录：${contentExcerpt}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  const prompt = [
    `【项目名称】\n${snapshot.base.name}`,
    snapshot.base.tagline ? `【一句话介绍】\n${snapshot.base.tagline}` : null,
    snapshot.base.description ? `【项目基础描述】\n${limitText(snapshot.base.description, 1600)}` : null,
    evidencePrompt ? `【Evidence Snapshot / 信息覆盖】\n${evidencePrompt}` : null,
    sourceContext ? `【来源正文摘要】\n${sourceContext}` : null,
    "【任务】\n请结构化分析该项目，重点识别功能、目标用户、使用场景、亮点、价值信号和信息不足点。",
    "仅当 GitHub missing 且官网 unreachable 且 curated/docs/social coverage 均低时，才在 summary/whatItIs/sourceNotes 中写「当前公开信息有限」。",
    "若仅有 GitHub missing 但官网或 curated 来源可用，应写「当前资料主要来自官网与公开收录来源」，不得脑补 GitHub 信息。",
    "请基于以下项目公开信息，输出 json，字段结构如下：",
    JSON.stringify(
      {
        knowledge: PROJECT_KNOWLEDGE_JSON_SCHEMA_EXAMPLE.knowledge,
        insight: {
          version: "v1",
          summary: "string",
          whatItIs: "string",
          whoFor: ["string"],
          useCases: ["string"],
          highlights: ["string"],
          valueSignals: ["string"],
          activity: { level: "high|medium|low|unknown", signals: ["string"] },
          risks: ["string"],
          suggestions: ["string"],
          completeness: {
            score: completeness.score,
            existing: completeness.existing,
            missing: completeness.missing,
          },
          sourceNotes: ["string"],
          generatedAt: new Date().toISOString(),
        },
        suggestedTags: ["string"],
        suggestedCategories: { primary: "string", secondary: "string", optional: ["string"] },
      },
      null,
      2,
    ),
    "注意：completeness 的 score/existing/missing 必须与输入一致，不要改写。",
    "knowledge.primaryCategory 必须使用固定枚举之一：AI_VIDEO, AI_IMAGE, AI_AGENT, AI_WRITING, DEV_TOOL, PRODUCTIVITY, SEARCH, EDUCATION, FINANCE, DATA_TOOL。",
    "knowledge.platforms 只能使用：web, ios, android, chrome_extension, desktop, api, wechat。",
    "knowledge.distributionChannels 只能使用：github, producthunt, chrome_store, app_store, wechat, twitter。",
    "禁止发明新的 category/platform/distribution 值。",
    "knowledge 必须基于 evidence 填写 platforms、techSignals、sourceCoverage，不得编造。",
    `项目 ID：${snapshot.base.projectId}`,
    snapshot.base.github ? `GitHub URL：${snapshot.base.github}` : null,
    snapshot.base.website ? `官网 URL：${snapshot.base.website}` : null,
  ].filter(Boolean).join("\n\n");

  let lastErr = "";
  let emptyContentAttempts = 0;
  let jsonParseFailedAttempts = 0;
  console.info("[AI][Insight] start", {
    projectId: snapshot.base.projectId,
    model,
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 3000,
        temperature: 0.2,
      });
      const usage = response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : null;
      const raw = response.choices?.[0]?.message?.content?.trim() ?? "";
      if (!raw) {
        emptyContentAttempts += 1;
        throw new Error("AI 返回空内容，请稍后重试");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripMarkdownCodeFence(raw)) as unknown;
      } catch {
        jsonParseFailedAttempts += 1;
        throw new Error("AI 输出格式异常，请稍后重试");
      }
      const normalized = ensureInsightShape(parsed, completeness, {
        evidenceSnapshot: snapshot.evidenceSnapshot,
      });
      const sanitized = sanitizeInsightAgainstWebsiteEvidence(
        normalized.insight,
        snapshot.website.evidence,
      );
      normalized.insight = sanitized;
      if (!normalized.suggestedTags.length) {
        normalized.suggestedTags = normalizeSuggestedTags(fallbackSuggest.tags.slice(0, 8));
      }
      if (!normalized.suggestedCategories.primary) {
        normalized.suggestedCategories.primary = normalized.knowledge.primaryCategory;
      }
      if (!normalized.knowledge.primaryCategory) {
        normalized.knowledge.primaryCategory =
          normalized.suggestedCategories.primary ??
          normalizeSuggestedCategories({
            primary: fallbackSuggest.primaryCategory,
          }).primary ??
          "other";
      }
      if (normalized.insight.activity.level === "unknown") {
        normalized.insight.activity.level = getActivityLevel(snapshot);
      }
      console.info("[AI][Insight] success", {
        projectId: snapshot.base.projectId,
        model,
        usage,
      });
      return normalized;
    } catch (error) {
      lastErr = error instanceof Error ? error.message : "AI insight 解析失败";
    }
  }
  console.error("[AI][Insight] failed", {
    projectId: snapshot.base.projectId,
    model,
    emptyContentAttempts,
    jsonParseFailedAttempts,
    error: lastErr,
  });
  throw new Error(lastErr || "AI insight 生成失败");
}

export async function saveProjectAIInsight(
  projectId: string,
  payload: {
    insight: ProjectAIInsight;
    signals: ProjectAISignals;
    completeness: ProjectAICompleteness;
    suggestedTags: string[];
    suggestedCategories: ProjectAISuggestedCategories;
    knowledge: ProjectKnowledge;
    sourceSnapshot: ProjectInsightSourceSnapshot;
    sourceLevel: ProjectAISourceLevel;
  },
) {
  const knowledge = payload.sourceSnapshot.evidenceSnapshot
    ? buildProjectKnowledgeFromEvidence({
        evidenceSnapshot: payload.sourceSnapshot.evidenceSnapshot,
        suggestedCategories: payload.suggestedCategories,
        suggestedTags: payload.suggestedTags,
        aiKnowledgePartial: payload.knowledge,
      })
    : normalizeProjectKnowledge(payload.knowledge, {
        suggestedCategories: payload.suggestedCategories,
      });

  await saveProjectKnowledge(projectId, knowledge);

  return prisma.project.update({
    where: { id: projectId },
    data: {
      aiInsight: payload.insight as unknown as Prisma.InputJsonValue,
      aiSignals: payload.signals as unknown as Prisma.InputJsonValue,
      aiCompleteness: payload.completeness as unknown as Prisma.InputJsonValue,
      aiSuggestedTags: payload.suggestedTags as unknown as Prisma.InputJsonValue,
      aiSuggestedCategories: payload.suggestedCategories as unknown as Prisma.InputJsonValue,
      aiSourceSnapshot: payload.sourceSnapshot as unknown as Prisma.InputJsonValue,
      aiSourceLevel: payload.sourceLevel,
      aiInsightStatus: "success",
      aiInsightError: null,
      aiInsightUpdatedAt: new Date(),
    },
    select: { id: true, aiInsightUpdatedAt: true },
  });
}

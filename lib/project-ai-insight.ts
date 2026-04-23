import type { Prisma } from "@prisma/client";
import { parseGitHubRepoUrl } from "@/lib/github";
import { suggestAdminProjectClassificationAndTags } from "@/lib/admin-project-classify-suggest";
import { getDeepSeekClient } from "@/lib/deepseek";
import { normalizeSuggestedCategories, normalizeSuggestedTags } from "@/lib/tag-normalization";
import { normalizeChineseExpression, normalizeChineseList } from "@/lib/zh-normalization";
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
};

export type ProjectAISignals = {
  github?: {
    repoUrl?: string;
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
};

type InsightGenerateResult = {
  insight: ProjectAIInsight;
  suggestedTags: string[];
  suggestedCategories: ProjectAISuggestedCategories;
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

async function fetchGitHubFacts(githubUrl: string | null) {
  if (!githubUrl) return { repoUrl: undefined };
  const parsed = parseGitHubRepoUrl(githubUrl);
  if (!parsed) return { repoUrl: githubUrl };
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MUHUB-AI-Insight",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const repoRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
      { headers, cache: "no-store" },
    );
    if (!repoRes.ok) return { repoUrl: githubUrl };
    const repoJson = (await repoRes.json()) as {
      stargazers_count?: number;
      forks_count?: number;
      subscribers_count?: number;
      open_issues_count?: number;
      pushed_at?: string | null;
      language?: string | null;
    };
    let releaseCount: number | null = null;
    const releaseRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/releases?per_page=1`,
      { headers, cache: "no-store" },
    );
    if (releaseRes.ok) {
      const link = releaseRes.headers.get("link");
      if (link) {
        const matched = link.match(/&page=(\d+)>; rel="last"/);
        releaseCount = matched ? Number(matched[1]) : 1;
      } else {
        const list = (await releaseRes.json()) as unknown[];
        releaseCount = Array.isArray(list) ? list.length : null;
      }
    }
    let readmeSummary: string | null = null;
    let readmeLength = 0;
    const readmeRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/readme`,
      { headers, cache: "no-store" },
    );
    if (readmeRes.ok) {
      const readmeJson = (await readmeRes.json()) as { content?: string; encoding?: string };
      if (readmeJson.encoding === "base64" && typeof readmeJson.content === "string") {
        const decoded = Buffer.from(readmeJson.content, "base64").toString("utf-8");
        readmeLength = decoded.trim().length;
        readmeSummary = limitText(decoded.replace(/\s+/g, " ").trim(), 500);
      }
    }
    const lastPushedAt = repoJson.pushed_at ?? null;
    const pushedDays =
      lastPushedAt
        ? Math.floor((Date.now() - new Date(lastPushedAt).getTime()) / (24 * 3600 * 1000))
        : null;
    const isActive = pushedDays != null ? pushedDays <= 90 : false;
    const hasReleases = typeof releaseCount === "number" ? releaseCount > 0 : false;
    return {
      repoUrl: githubUrl,
      stars: typeof repoJson.stargazers_count === "number" ? repoJson.stargazers_count : null,
      forks: typeof repoJson.forks_count === "number" ? repoJson.forks_count : null,
      watchers: typeof repoJson.subscribers_count === "number" ? repoJson.subscribers_count : null,
      openIssues: typeof repoJson.open_issues_count === "number" ? repoJson.open_issues_count : null,
      lastPushedAt,
      language: repoJson.language ?? null,
      releaseCount,
      commitSignal: [],
      readmeSummary,
      readmeLength,
      isActive,
      hasReleases,
    };
  } catch {
    return { repoUrl: githubUrl };
  }
}

async function fetchWebsiteFacts(websiteUrl: string | null) {
  if (!websiteUrl) {
    return {
      url: undefined,
      exists: false,
      title: null,
      description: null,
    };
  }
  try {
    const res = await fetch(websiteUrl, { cache: "no-store" });
    if (!res.ok) {
      return { url: websiteUrl, exists: false, title: null, description: null };
    }
    const html = await res.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
    const description =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() ??
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() ??
      null;
    return {
      url: websiteUrl,
      exists: true,
      title: title ? limitText(title, 160) : null,
      description: description ? limitText(description, 280) : null,
    };
  } catch {
    return { url: websiteUrl, exists: false, title: null, description: null };
  }
}

export async function buildProjectInsightSourceSnapshot(projectId: string): Promise<ProjectInsightSourceSnapshot | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      socialAccounts: true,
      externalLinks: true,
      updates: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 8,
      },
    },
  });
  if (!row) return null;

  const socialsAccounts: Record<string, string | null> = {
    twitter: null,
    wechatOfficialAccount: null,
    discord: null,
    telegram: null,
    linkedin: null,
    youtube: null,
  };
  for (const account of row.socialAccounts) {
    const url = account.accountUrl?.trim() || null;
    if (account.platform === "X" && !socialsAccounts.twitter) socialsAccounts.twitter = url;
    if (account.platform === "WECHAT_OFFICIAL" && !socialsAccounts.wechatOfficialAccount) socialsAccounts.wechatOfficialAccount = account.accountName || url;
    if (account.platform === "DISCORD" && !socialsAccounts.discord) socialsAccounts.discord = url;
    if (account.platform === "BILIBILI" && !socialsAccounts.youtube) socialsAccounts.youtube = url;
  }
  for (const link of row.externalLinks) {
    const p = link.platform.toLowerCase();
    if (p.includes("twitter") || p === "x") socialsAccounts.twitter ??= link.url;
    if (p.includes("telegram")) socialsAccounts.telegram ??= link.url;
    if (p.includes("linkedin")) socialsAccounts.linkedin ??= link.url;
    if (p.includes("youtube")) socialsAccounts.youtube ??= link.url;
    if (p.includes("discord")) socialsAccounts.discord ??= link.url;
  }

  const [githubFactsRaw, websiteFacts] = await Promise.all([
    fetchGitHubFacts(row.githubUrl),
    fetchWebsiteFacts(row.websiteUrl),
  ]);
  const githubFacts = githubFactsRaw as ProjectAISignals["github"] & { readmeSummary?: string | null };
  const websiteText = `${websiteFacts.title ?? ""} ${websiteFacts.description ?? ""}`.toLowerCase();
  const hasPricing = websiteText.includes("pricing") || websiteText.includes("价格");
  const hasDocs = websiteText.includes("docs") || websiteText.includes("文档");
  const hasContact = websiteText.includes("contact") || websiteText.includes("联系我们");
  const hasDemo = websiteText.includes("demo") || websiteText.includes("演示");
  const hasContent = Boolean((websiteFacts.description ?? "").trim()) || Boolean((websiteFacts.title ?? "").trim());
  const hasKeySections = hasPricing || hasDocs || hasContact || hasDemo;

  const mainSources: string[] = [];
  if (row.githubUrl) mainSources.push("GitHub");
  if (row.websiteUrl) mainSources.push("官网");
  if (row.description?.trim() || row.tagline?.trim()) mainSources.push("项目描述");
  if (Object.values(socialsAccounts).some(Boolean)) mainSources.push("社媒");
  const missingSources: string[] = [];
  if (!row.websiteUrl) missingSources.push("未检测到官网");
  if (!row.githubUrl) missingSources.push("未检测到 GitHub");
  if (!Object.values(socialsAccounts).some(Boolean)) missingSources.push("未检测到社媒账号");

  return {
    base: {
      projectId: row.id,
      name: row.name,
      tagline: row.tagline,
      description: row.description,
      website: row.websiteUrl,
      github: row.githubUrl,
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
        repoUrl: githubFacts.repoUrl,
        stars: githubFacts.stars,
        forks: githubFacts.forks,
        watchers: githubFacts.watchers,
        openIssues: githubFacts.openIssues,
        lastPushedAt: githubFacts.lastPushedAt,
        language: githubFacts.language,
        releaseCount: githubFacts.releaseCount,
        commitSignal: githubFacts.commitSignal,
      },
      readmeSummary: githubFacts.readmeSummary ?? null,
    },
    website: {
      facts: websiteFacts,
      hasPricing,
      hasDocs,
      hasContact,
      hasDemo,
      hasContent,
      hasKeySections,
    },
    socials: {
      accounts: socialsAccounts,
      exists: {
        twitter: Boolean(socialsAccounts.twitter),
        discord: Boolean(socialsAccounts.discord),
        telegram: Boolean(socialsAccounts.telegram),
        linkedin: Boolean(socialsAccounts.linkedin),
      },
    },
    extractedSignals: {
      mainSources,
      missingSources,
    },
  };
}

export function computeProjectCompleteness(snapshot: ProjectInsightSourceSnapshot): ProjectAICompleteness {
  const checks: Array<{ name: string; ok: boolean; weight: number }> = [
    { name: "官网", ok: Boolean(snapshot.base.website), weight: 9 },
    { name: "GitHub", ok: Boolean(snapshot.base.github), weight: 9 },
    { name: "一句话介绍", ok: Boolean(snapshot.base.tagline?.trim()), weight: 9 },
    { name: "详细介绍", ok: Boolean(snapshot.base.description?.trim()), weight: 10 },
    { name: "使用场景说明", ok: Boolean(snapshot.base.description?.trim()), weight: 9 },
    { name: "目标用户说明", ok: Boolean(snapshot.base.description?.trim()), weight: 9 },
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

  if (hasGithub && hasWebsite && hasSocial) return "A";
  if (hasGithub && hasWebsite) return "B";
  if (hasGithub) return "C";
  if (hasDescription) return "D";
  return "E";
}

function ensureInsightShape(
  input: unknown,
  completeness: ProjectAICompleteness,
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

  return { insight: parsed, suggestedTags, suggestedCategories };
}

export async function generateProjectAIInsight(
  snapshot: ProjectInsightSourceSnapshot,
  completeness: ProjectAICompleteness,
): Promise<InsightGenerateResult> {
  const client = getDeepSeekClient();
  const model = process.env.DEEPSEEK_MODEL_INSIGHT?.trim() || "deepseek-chat";
  const fallbackSuggest = suggestAdminProjectClassificationAndTags({
    githubUrl: snapshot.base.github ?? "",
    tagline: snapshot.base.tagline ?? "",
    description: snapshot.base.description ?? "",
    name: snapshot.base.name,
    websiteUrl: snapshot.base.website ?? "",
    aiCardSummary: "",
  });
  const systemPrompt = [
    "你是 MUHUB 的项目公开信息整理助手。",
    "你的任务不是评价项目优劣，也不是给投资建议，而是把项目公开信息整理为结构化中文认知卡。",
    "只能依据输入内容整理，不得编造不存在的事实。",
    "不得输出“值得投资”“行业领先”“前景巨大”等武断结论。",
    "信息不足时要明确指出信息不足，不要猜测。",
    "sourceNotes 需要明确标注信息来源类型（例如 GitHub / 官网 / 项目描述），并指出缺失来源。",
    "必须区分“来源存在”和“来源有效”：例如官网存在但内容很少、GitHub 存在但长期不活跃。",
    "若 GitHub 超过 90 天无更新、README 过短或官网缺少关键栏目，应在 risks/suggestions/sourceNotes 中明确提示。",
    "输出必须是合法 json，不要输出 markdown。",
    "你必须输出 json。",
  ].join("\n");
  const prompt = [
    "请基于以下项目公开信息，输出 json，字段结构如下：",
    JSON.stringify(
      {
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
    `输入快照：${JSON.stringify(snapshot)}`,
  ].join("\n\n");

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
      const normalized = ensureInsightShape(parsed, completeness);
      if (!normalized.suggestedTags.length) {
        normalized.suggestedTags = normalizeSuggestedTags(fallbackSuggest.tags.slice(0, 8));
      }
      if (!normalized.suggestedCategories.primary) {
        normalized.suggestedCategories.primary = normalizeSuggestedCategories({
          primary: fallbackSuggest.primaryCategory,
        }).primary;
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
    sourceSnapshot: ProjectInsightSourceSnapshot;
    sourceLevel: ProjectAISourceLevel;
  },
) {
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

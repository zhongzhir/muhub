/**
 * Entity Discovery E1.5 — AI Entity Judge
 * 从 Signal 文本判断高价值实体，优先于规则抽取（WEBSITE_SCAN 默认启用）。
 */

import { generateText } from "@/lib/ai/generate-text";
import { getResolvedAiConfig } from "@/lib/ai/ai-config";
import {
  GENERIC_BLACKLIST,
  NAVIGATION_BLACKLIST,
} from "@/lib/discovery/entity/hint-quality-filter";
import type { ExtractedEntityHintDraft, SourceAuthorityTier } from "@/lib/discovery/entity/types";
import { authorityTierBoost } from "@/lib/discovery/entity/types";
import { parseWebsiteScanSignalMetadata } from "@/lib/discovery/website-scan/signal-metadata";
import { loadFeedbackExamplesForJudgePrompt } from "@/lib/discovery/entity/feedback-examples-for-judge";

export type AiEntityJudgeInput = {
  title: string;
  summary?: string | null;
  url: string;
  signalType: string;
  sourceType: string;
  sourceName: string;
  discoveryScopes: string[];
  sourceAuthorityTier?: SourceAuthorityTier;
  metadataJson?: unknown;
  minConfidence?: number;
  minRelevance?: number;
};

export type AiJudgedEntity = {
  name: string;
  entityType: string;
  confidence: number;
  publishingAiRelevance: number;
  shouldCreateHint: boolean;
  reason: string;
  evidence: string;
};

export type AiEntityJudgeResult = {
  /** 技术失败（API/解析）— 应回退规则抽取 */
  failed: boolean;
  error?: string;
  entities: AiJudgedEntity[];
  /** AI 明确拒绝的候选（用于验收/调试） */
  rejected: AiJudgedEntity[];
  skippedReason?: string;
  model?: string;
};

const DEFAULT_MIN_CONFIDENCE = 0.75;
const DEFAULT_MIN_RELEVANCE = 0.60;

function resolveThresholds(
  tier: SourceAuthorityTier,
  minConfidence: number,
  minRelevance: number,
): { minConfidence: number; minRelevance: number; relaxed: boolean } {
  if (tier === "regulatory") {
    return {
      minConfidence: Math.min(minConfidence, 0.7),
      minRelevance: Math.min(minRelevance, 0.55),
      relaxed: true,
    };
  }
  if (tier === "industry_association") {
    return {
      minConfidence: Math.min(minConfidence, 0.72),
      minRelevance: Math.min(minRelevance, 0.58),
      relaxed: true,
    };
  }
  return { minConfidence, minRelevance, relaxed: false };
}

function parseJudgeJson(raw: string): { entities: AiJudgedEntity[]; skippedReason?: string } | null {
  const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonStr) {
    return null;
  }
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  const skippedReason =
    typeof parsed.skippedReason === "string" && parsed.skippedReason.trim()
      ? parsed.skippedReason.trim()
      : undefined;

  const rawEntities = parsed.entities;
  if (!Array.isArray(rawEntities)) {
    return { entities: [], skippedReason };
  }

  const entities: AiJudgedEntity[] = [];
  for (const item of rawEntities) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) {
      continue;
    }
    entities.push({
      name,
      entityType:
        typeof row.entityType === "string" ? row.entityType.trim().toUpperCase() : "OTHER",
      confidence: typeof row.confidence === "number" ? row.confidence : 0,
      publishingAiRelevance:
        typeof row.publishingAiRelevance === "number" ? row.publishingAiRelevance : 0,
      shouldCreateHint: row.shouldCreateHint === true,
      reason: typeof row.reason === "string" ? row.reason.trim() : "",
      evidence: typeof row.evidence === "string" ? row.evidence.trim() : "",
    });
  }

  return { entities, skippedReason };
}

function isHardBlockedName(name: string): boolean {
  const normalized = name.trim().replace(/\s+/g, "");
  if (NAVIGATION_BLACKLIST.has(normalized) || GENERIC_BLACKLIST.has(normalized)) {
    return true;
  }
  return false;
}

function applyThresholds(
  entities: AiJudgedEntity[],
  thresholds: { minConfidence: number; minRelevance: number; relaxed: boolean },
): { accepted: AiJudgedEntity[]; rejected: AiJudgedEntity[] } {
  const accepted: AiJudgedEntity[] = [];
  const rejected: AiJudgedEntity[] = [];

  for (const entity of entities) {
    if (isHardBlockedName(entity.name)) {
      rejected.push({
        ...entity,
        shouldCreateHint: false,
        reason: `${entity.reason || ""} [hard_blocklist]`.trim(),
      });
      continue;
    }

    const pass =
      entity.shouldCreateHint &&
      entity.confidence >= thresholds.minConfidence &&
      entity.publishingAiRelevance >= thresholds.minRelevance;

    if (pass) {
      accepted.push({
        ...entity,
        reason: thresholds.relaxed
          ? `${entity.reason}（权威来源阈值略放宽）`
          : entity.reason,
      });
    } else {
      rejected.push(entity);
    }
  }

  return { accepted, rejected };
}

function buildJudgePrompt(
  input: AiEntityJudgeInput,
  scanMeta: ReturnType<typeof parseWebsiteScanSignalMetadata>,
  feedbackExamplesBlock: string,
): string {
  const snippet = input.summary?.trim() || scanMeta?.snippet || "";
  const matchedKeywords = scanMeta?.matchedKeywords?.join("、") || "（无）";
  const pageUrl = scanMeta?.pageUrl || input.url;
  const sourceKey = scanMeta?.sourceKey || "（未知）";

  const examplesSection = feedbackExamplesBlock
    ? `\n${feedbackExamplesBlock}\n`
    : "";

  return `你是出版与 AI 行业的实体识别裁判（Entity Judge）。从以下 Signal 中判断是否存在**值得进入 EntityHint 的高价值具体实体**。

## 必须拒绝（shouldCreateHint=false）
- 导航/功能入口：下载中心、投稿指南、期刊征订、编辑部、联系我们、关于我们、首页、更多、通知公告、新闻动态
- 栏目名、网站模块名
- 泛概念词：人工智能、数字出版、大模型、AIGC、智能出版、出版科技（单独作为实体名时）
- **纯文章标题**（无论多长，若只是文章/报告/论文标题而非机构/产品/公司名，拒绝）
- 无具体指代的抽象短语

## 可以接受
- 具体机构/出版社/协会/局署
- 具体公司/集团（含有限公司等）
- 实验室/研究中心/研究院
- 具名 AI/出版工具、平台、产品（有明确名称）
- 具名会议/论坛（若文本中明确作为实体出现）

## Signal
- 标题：${input.title}
- 摘要/snippet：${snippet || "（无）"}
- pageUrl：${pageUrl}
- 命中关键词：${matchedKeywords}
- sourceKey：${sourceKey}
- 来源：${input.sourceName}（${input.sourceType}）
- signalType：${input.signalType}
- discoveryScopes：${input.discoveryScopes.join(", ")}
${examplesSection}
只返回 JSON 对象（不要 markdown）：
{
  "entities": [
    {
      "name": "实体名称",
      "entityType": "PROJECT|COMPANY|ORGANIZATION|LAB|TOOL|PLATFORM|DATASET|EVENT|OTHER",
      "confidence": 0.0,
      "publishingAiRelevance": 0.0,
      "shouldCreateHint": true,
      "reason": "中文，为何是/不是实体",
      "evidence": "原文片段"
    }
  ],
  "skippedReason": "若全部拒绝，说明原因；有接受项可省略或为空"
}

找不到任何合格实体时 entities=[] 并填写 skippedReason。不要输出用户可见评分文案。`;
}

export async function runAiEntityJudge(input: AiEntityJudgeInput): Promise<AiEntityJudgeResult> {
  const tier = input.sourceAuthorityTier ?? "unknown";
  const minConfidence = input.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const minRelevance = input.minRelevance ?? DEFAULT_MIN_RELEVANCE;
  const thresholds = resolveThresholds(tier, minConfidence, minRelevance);
  const scanMeta = parseWebsiteScanSignalMetadata(input.metadataJson, {
    signalType: input.signalType,
    url: input.url,
    title: input.title,
    summary: input.summary,
  });

  try {
    const feedbackExamples = await loadFeedbackExamplesForJudgePrompt(6);
    const prompt = buildJudgePrompt(input, scanMeta, feedbackExamples);
    const raw = await generateText(prompt, {
      maxTokens: 1400,
      temperature: 0.1,
      systemPrompt:
        "你是 Entity Judge。只返回 JSON 对象，不要其他文字。严格区分具体实体与栏目/导航/文章标题/泛概念。",
    });

    const parsed = parseJudgeJson(raw);
    if (!parsed) {
      return {
        failed: true,
        error: "AI Judge JSON 解析失败",
        entities: [],
        rejected: [],
      };
    }

    const cfg = getResolvedAiConfig();
    const { accepted, rejected } = applyThresholds(parsed.entities, thresholds);

    return {
      failed: false,
      entities: accepted,
      rejected,
      skippedReason:
        accepted.length === 0
          ? parsed.skippedReason || "ai_judge_no_entities_passed_threshold"
          : parsed.skippedReason,
      model: cfg.model,
    };
  } catch (error) {
    return {
      failed: true,
      error: error instanceof Error ? error.message : String(error),
      entities: [],
      rejected: [],
    };
  }
}

export function aiJudgedEntitiesToHintDrafts(args: {
  entities: AiJudgedEntity[];
  input: AiEntityJudgeInput;
  model?: string;
  matchedKeywords?: string[];
  pageUrl?: string;
}): ExtractedEntityHintDraft[] {
  const tier = args.input.sourceAuthorityTier ?? "unknown";
  const scanMeta = parseWebsiteScanSignalMetadata(args.input.metadataJson, {
    signalType: args.input.signalType,
    url: args.input.url,
    title: args.input.title,
    summary: args.input.summary,
  });
  const matchedKeywords = args.matchedKeywords ?? scanMeta?.matchedKeywords ?? [];
  const pageUrl = args.pageUrl ?? scanMeta?.pageUrl ?? args.input.url;
  const sourceText = [args.input.title, args.input.summary].filter(Boolean).join("\n").slice(0, 500);

  return args.entities.map((entity) => ({
    name: entity.name,
    entityType: entity.entityType,
    confidence: Math.min(0.95, entity.confidence + authorityTierBoost(tier)),
    reason: entity.reason || "AI Entity Judge",
    sourceTextSnippet: entity.evidence?.slice(0, 200) || undefined,
    evidenceJson: {
      extractionMethod: "ai",
      judge: "ai_entity_judge",
      sourceText,
      matchedKeywords,
      publishingAiRelevance: entity.publishingAiRelevance,
      aiReason: entity.reason,
      aiEvidence: entity.evidence,
      model: args.model,
      createdBy: "ai",
      aiModel: args.model,
      sourceAuthorityTier: tier,
      signalType: args.input.signalType,
      sourceType: args.input.sourceType,
      pageUrl,
    },
  }));
}

export function isAiEntityJudgeEvidence(evidenceJson: unknown): boolean {
  if (!evidenceJson || typeof evidenceJson !== "object" || Array.isArray(evidenceJson)) {
    return false;
  }
  return (evidenceJson as Record<string, unknown>).judge === "ai_entity_judge";
}

export type ParsedAiJudgeEvidence = {
  isAiJudge: boolean;
  aiReason?: string;
  aiEvidence?: string;
  publishingAiRelevance?: number;
  pageUrl?: string;
  model?: string;
  matchedKeywords?: string[];
};

export function parseAiJudgeEvidence(evidenceJson: unknown): ParsedAiJudgeEvidence {
  if (!isAiEntityJudgeEvidence(evidenceJson)) {
    return { isAiJudge: false };
  }
  const ev = evidenceJson as Record<string, unknown>;
  return {
    isAiJudge: true,
    aiReason: typeof ev.aiReason === "string" ? ev.aiReason : undefined,
    aiEvidence: typeof ev.aiEvidence === "string" ? ev.aiEvidence : undefined,
    publishingAiRelevance:
      typeof ev.publishingAiRelevance === "number" ? ev.publishingAiRelevance : undefined,
    pageUrl: typeof ev.pageUrl === "string" ? ev.pageUrl : undefined,
    model: typeof ev.model === "string" ? ev.model : undefined,
    matchedKeywords: Array.isArray(ev.matchedKeywords)
      ? ev.matchedKeywords.filter((k): k is string => typeof k === "string")
      : undefined,
  };
}

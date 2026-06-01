import { generateText } from "@/lib/ai/generate-text";
import { getResolvedAiConfig } from "@/lib/ai/ai-config";
import {
  GENERIC_BLACKLIST,
  NAVIGATION_BLACKLIST,
} from "@/lib/discovery/entity/hint-quality-filter";
import { loadFeedbackExamplesForJudgePrompt } from "@/lib/discovery/entity/feedback-examples-for-judge";
import { authorityTierBoost, type ExtractedEntityHintDraft, type SourceAuthorityTier } from "@/lib/discovery/entity/types";
import { parseWebsiteScanSignalMetadata } from "@/lib/discovery/website-scan/signal-metadata";

export type AiEntityJudgeInput = {
  title: string;
  summary?: string | null;
  rawText?: string | null;
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
  failed: boolean;
  error?: string;
  entities: AiJudgedEntity[];
  rejected: AiJudgedEntity[];
  skippedReason?: string;
  model?: string;
};

const DEFAULT_MIN_CONFIDENCE = 0.75;
const DEFAULT_MIN_RELEVANCE = 0.6;

const ALLOWED_ENTITY_TYPES = new Set([
  "PROJECT",
  "MODEL",
  "DATASET",
  "TOOL",
  "ORGANIZATION",
  "COMPANY",
  "LAB",
  "PLATFORM",
  "EVENT",
  "CONCEPT",
  "METHOD",
  "PERSON",
  "UNKNOWN",
]);

function normalizeEntityType(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "UNKNOWN";
  if (value === "OTHER") {
    return "UNKNOWN";
  }
  return ALLOWED_ENTITY_TYPES.has(value) ? value : "UNKNOWN";
}

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
      entityType: normalizeEntityType(row.entityType),
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
  return NAVIGATION_BLACKLIST.has(normalized) || GENERIC_BLACKLIST.has(normalized);
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
        reason: thresholds.relaxed ? `${entity.reason} (relaxed_source_threshold)` : entity.reason,
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
  const text = (input.rawText?.trim() || input.summary?.trim() || scanMeta?.snippet || "").slice(
    0,
    12000,
  );
  const pageUrl = scanMeta?.pageUrl || input.url;
  const matchedKeywords = scanMeta?.matchedKeywords?.join(", ") || "(none)";
  const examplesSection = feedbackExamplesBlock ? `\n${feedbackExamplesBlock}\n` : "";

  return `你是 MUHUB Discovery Engine 的实体抽取器。请从网页 Signal 中抽取值得进入 Entity Queue、等待人工判断的实体。

核心要求：
- 不要把通用概念当项目。
- 区分 project / model / dataset / tool / organization / concept / method / person / unknown。
- 表格、名单、获奖项目列表要逐条抽取，不要只抽文章标题。
- 如果只是方法名或概念名，标为 METHOD 或 CONCEPT，不要标为 PROJECT。
- Website Scan 来源默认是 secondary evidence，不代表它就是项目主来源。
- 只输出 JSON 对象，不要输出 Markdown。

实体类型只能使用：
PROJECT, MODEL, DATASET, TOOL, ORGANIZATION, COMPANY, LAB, PLATFORM, EVENT, CONCEPT, METHOD, PERSON, UNKNOWN

Signal:
- title: ${input.title}
- url: ${pageUrl}
- sourceName: ${input.sourceName}
- sourceType: ${input.sourceType}
- signalType: ${input.signalType}
- matchedKeywords: ${matchedKeywords}
- discoveryScopes: ${input.discoveryScopes.join(", ")}

正文:
${text || "(empty)"}
${examplesSection}
返回格式：
{
  "entities": [
    {
      "name": "实体名称",
      "entityType": "PROJECT",
      "confidence": 0.0,
      "publishingAiRelevance": 0.0,
      "shouldCreateHint": true,
      "reason": "为什么值得进入 Entity Queue",
      "evidence": "原文证据片段"
    }
  ],
  "skippedReason": "如果没有合格实体，说明原因"
}`;
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
      maxTokens: 2200,
      temperature: 0.1,
      systemPrompt:
        "你是 Entity Judge。只返回 JSON 对象，不要输出其它文字。严格区分具体实体、方法、概念、文章标题和导航噪声。",
    });

    const parsed = parseJudgeJson(raw);
    if (!parsed) {
      return {
        failed: true,
        error: "AI Judge JSON parse failed",
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
  const sourceText = [args.input.title, args.input.summary, args.input.rawText]
    .filter(Boolean)
    .join("\n")
    .slice(0, 1000);

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

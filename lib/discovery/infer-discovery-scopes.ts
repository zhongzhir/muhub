import type { DiscoveryCandidate, DiscoverySource } from "@prisma/client";
import {
  mergeDiscoveryScopes,
  type DiscoveryScope,
} from "@/lib/discovery/discovery-scopes";
import {
  metadataDiscoveryScopes,
  parseScopesFromConfigJson,
} from "@/lib/discovery/scope-from-config";
import { PUBLISHING_KEYWORD_TO_TAGS } from "@/lib/discovery/classification/keyword-rules";

const AI_HINT_PATTERNS = [
  " ai ",
  "artificial intelligence",
  "machine learning",
  " llm",
  "gpt",
  "generative",
  "nlp",
  "large language",
  "deep learning",
  "openai",
  "chatbot",
  "agent",
  "rag ",
  "embedding",
];

function haystackFromCandidate(
  cand: Pick<DiscoveryCandidate, "title" | "summary" | "descriptionRaw" | "tagsJson">,
): string {
  const tags =
    Array.isArray(cand.tagsJson) && cand.tagsJson.every((t) => typeof t === "string")
      ? (cand.tagsJson as string[]).join(" ")
      : "";
  return [cand.title, cand.summary, cand.descriptionRaw, tags]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function matchesAnyPattern(haystack: string, patterns: string[]): boolean {
  return patterns.some((p) => haystack.includes(p.toLowerCase()));
}

/** 规则推断：是否像出版 AI 项目（非评分，仅 scope 标签） */
export function inferPublishingAiScopeByRules(
  cand: Pick<DiscoveryCandidate, "title" | "summary" | "descriptionRaw" | "tagsJson">,
): { match: boolean; signals: string[] } {
  const haystack = haystackFromCandidate(cand);
  if (!haystack.trim()) {
    return { match: false, signals: [] };
  }

  const signals: string[] = [];
  const publishingPatterns = PUBLISHING_KEYWORD_TO_TAGS.flatMap((r) => r.patterns);
  const hasPublishing = matchesAnyPattern(haystack, publishingPatterns);
  const hasAi = matchesAnyPattern(haystack, AI_HINT_PATTERNS);

  if (hasPublishing) {
    signals.push("keyword:publishing");
  }
  if (hasAi) {
    signals.push("keyword:ai");
  }

  // 出版来源的项目：来源 scope 已标记 publishing_ai 时由上层继承
  return { match: hasPublishing && hasAi, signals };
}

export type ScopeInferenceInput = {
  sourceConfigJson: unknown;
  candidateMetadataJson?: unknown;
  title?: string;
  summary?: string | null;
  descriptionRaw?: string | null;
  tagsJson?: unknown;
  primaryCategory?: string | null;
};

/**
 * 综合推断 discovery scopes：来源继承 + metadata + 规则。
 * AI LLM 推断在 Phase 3 画像阶段增强。
 */
export function inferDiscoveryScopes(input: ScopeInferenceInput): {
  scopes: DiscoveryScope[];
  scopeSignals: string[];
} {
  const fromSource = parseScopesFromConfigJson(input.sourceConfigJson);
  const fromMeta = metadataDiscoveryScopes(input.candidateMetadataJson ?? null);
  const scopes = mergeDiscoveryScopes(fromSource, fromMeta);

  const scopeSignals: string[] = [];

  if (fromSource.includes("publishing_ai")) {
    scopeSignals.push("source:publishing_ai");
  }

  const ruleInput = {
    title: input.title ?? "",
    summary: input.summary ?? null,
    descriptionRaw: input.descriptionRaw ?? null,
    tagsJson: input.tagsJson ?? null,
  };
  const publishingRule = inferPublishingAiScopeByRules(ruleInput);
  scopeSignals.push(...publishingRule.signals);

  if (publishingRule.match && !scopes.includes("publishing_ai")) {
    scopes.push("publishing_ai");
    scopeSignals.push("rule:publishing_ai");
  }

  if (input.primaryCategory === "publishing_media" && !scopes.includes("publishing_ai")) {
    scopes.push("publishing_ai");
    scopeSignals.push("category:publishing_media");
  }

  return { scopes: mergeDiscoveryScopes(scopes), scopeSignals };
}

export function resolveCandidateDiscoveryScopes(
  cand: Pick<
    DiscoveryCandidate,
    "title" | "summary" | "descriptionRaw" | "tagsJson" | "metadataJson" | "categoriesJson"
  >,
  source: Pick<DiscoverySource, "configJson">,
): DiscoveryScope[] {
  const primaryCategory =
    Array.isArray(cand.categoriesJson) &&
    cand.categoriesJson.length > 0 &&
    typeof cand.categoriesJson[0] === "string"
      ? cand.categoriesJson[0]
      : null;

  return inferDiscoveryScopes({
    sourceConfigJson: source.configJson,
    candidateMetadataJson: cand.metadataJson,
    title: cand.title,
    summary: cand.summary,
    descriptionRaw: cand.descriptionRaw,
    tagsJson: cand.tagsJson,
    primaryCategory,
  }).scopes;
}

import {
  CHINESE_TOOL_PATTERNS,
  GENERIC_AI_HINT_PATTERNS,
  KEYWORD_RULES,
  primaryTypeRank,
} from "./keyword-rules";
import { applyTopicRules } from "./topic-rules";

export type ClassificationInput = {
  title: string;
  summary: string | null;
  descriptionRaw: string | null;
  tagsJson: unknown;
  website: string | null;
  docsUrl: string | null;
  repoUrl: string | null;
  language: string | null;
  enrichmentLinks?: { platform: string; url: string }[];
};

export type ClassificationResult = {
  suggestedType: string;
  suggestedTags: string[];
  classificationScore: number;
  evidence: string[];
  isAiRelated: boolean;
  isChineseTool: boolean;
};

const MIN_TYPE_WEIGHT_FALLBACK = 2.5;
const MAX_TAGS = 8;
const MAX_EVIDENCE = 24;

function parseGithubTopics(tagsJson: unknown): string[] {
  if (!Array.isArray(tagsJson)) {
    return [];
  }
  return tagsJson.filter((x): x is string => typeof x === "string");
}

/**
 * 规则分类 V1：无外部模型；可解释 evidence 供后台展示。
 */
export function classifyDiscoveryCandidate(input: ClassificationInput): ClassificationResult {
  const topics = parseGithubTopics(input.tagsJson);
  const titleLower = input.title.toLowerCase();
  const summaryLower = (input.summary ?? "").toLowerCase();
  const descLower = (input.descriptionRaw ?? "").toLowerCase();
  const urls = [input.website, input.docsUrl, input.repoUrl]
    .filter((x): x is string => Boolean(x?.trim()))
    .join(" ")
    .toLowerCase();

  const linksText =
    input.enrichmentLinks?.length ?
      input.enrichmentLinks.map((l) => `${l.platform} ${l.url}`).join(" ").toLowerCase()
    : "";

  const haystack = [titleLower, summaryLower, descLower, urls, linksText].join("\n");

  const typeWeights: Record<string, number> = {};
  const evidence: string[] = [];
  const keywordTagCandidates = new Set<string>();

  for (const rule of KEYWORD_RULES) {
    for (const p of rule.patterns) {
      const needle = p.toLowerCase();
      if (!needle || !haystack.includes(needle)) {
        continue;
      }
      let where = "text";
      if (titleLower.includes(needle)) {
        where = "title";
      } else if (summaryLower.includes(needle)) {
        where = "summary";
      } else if (descLower.includes(needle)) {
        where = "description";
      }
      typeWeights[rule.type] = (typeWeights[rule.type] ?? 0) + rule.weight;
      evidence.push(`matched keyword (${where}): ${needle.trim()}`);
      if (rule.tag) {
        keywordTagCandidates.add(rule.tag);
      }
      break;
    }
  }

  const topicResult = applyTopicRules(topics);
  for (const [t, w] of Object.entries(topicResult.typeWeights)) {
    typeWeights[t] = (typeWeights[t] ?? 0) + w;
  }
  evidence.push(...topicResult.evidence);

  let bestType = "General AI Tool";
  let bestScore = 0;
  for (const [t, w] of Object.entries(typeWeights)) {
    if (w > bestScore) {
      bestScore = w;
      bestType = t;
    } else if (w === bestScore && w > 0 && primaryTypeRank(t) < primaryTypeRank(bestType)) {
      bestType = t;
    }
  }

  if (bestScore < MIN_TYPE_WEIGHT_FALLBACK) {
    bestType = "General AI Tool";
  }

  let genericHit = false;
  for (const g of GENERIC_AI_HINT_PATTERNS) {
    const needle = g.toLowerCase();
    if (haystack.includes(needle)) {
      genericHit = true;
      evidence.push(`matched summary phrase signal: ${g}`);
      break;
    }
  }

  let isChineseTool = false;
  for (const c of CHINESE_TOOL_PATTERNS) {
    if (haystack.includes(c.toLowerCase())) {
      isChineseTool = true;
      evidence.push(`matched Chinese-market hint: ${c}`);
      break;
    }
  }

  const lang = (input.language ?? "").toLowerCase();
  if (lang.startsWith("zh") || lang.includes("chinese")) {
    isChineseTool = true;
    evidence.push("language / locale suggests Chinese context");
  }

  const suggestedTags: string[] = [];
  const seen = new Set<string>();
  const pushTag = (x: string) => {
    const k = x.trim();
    if (!k || suggestedTags.length >= MAX_TAGS) {
      return;
    }
    const lk = k.toLowerCase();
    if (seen.has(lk)) {
      return;
    }
    seen.add(lk);
    suggestedTags.push(k);
  };

  for (const t of topicResult.tags) {
    pushTag(t);
  }
  for (const t of keywordTagCandidates) {
    pushTag(t);
  }

  const maxTypeScore = Math.max(bestScore, ...Object.values(typeWeights), 0);
  const classificationScore = Math.min(
    1,
    0.12 +
      maxTypeScore * 0.055 +
      Math.min(0.38, evidence.length * 0.032) +
      (genericHit ? 0.08 : 0),
  );

  const isAiRelated =
    bestType !== "General AI Tool" ||
    genericHit ||
    maxTypeScore >= 1 ||
    topicResult.tags.length > 0;

  return {
    suggestedType: bestType,
    suggestedTags,
    classificationScore: Math.round(classificationScore * 100) / 100,
    evidence: evidence.slice(0, MAX_EVIDENCE),
    isAiRelated,
    isChineseTool,
  };
}

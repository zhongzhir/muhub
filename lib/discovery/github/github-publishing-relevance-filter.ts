import { PUBLISHING_KEYWORD_TO_TAGS } from "@/lib/discovery/classification/keyword-rules";

const PUBLISHING_PATTERNS = [
  ...PUBLISHING_KEYWORD_TO_TAGS.flatMap((r) => r.patterns),
  "book",
  "books",
  "author",
  "editorial",
  "writing",
  "publisher",
  "publish",
  "ebook",
  "epub",
  "manuscript",
  "typeset",
  "self-publishing",
  "audiobook",
  "content production",
];

const AI_PATTERNS = [
  " ai ",
  "artificial intelligence",
  "machine learning",
  " llm",
  "gpt",
  "generative",
  "nlp",
  "chatgpt",
  "openai",
  "deep learning",
  "text generation",
  "writing assistant",
  "rag ",
  "embedding",
];

/** 明显与出版 AI 无关的 repo 名称/描述模式 */
const BLOCK_PATTERNS = [
  "trading-bot",
  "trading bot",
  "crypto",
  "forex",
  "stock market",
  "defi",
  "arbitrage",
  "xiaohongshu-agent",
  "xhs-agent",
  "meme coin",
  "nft mint",
  "minecraft",
  "game hack",
];

export type GithubPublishingRelevanceResult = {
  pass: boolean;
  confidence: number;
  reasons: string[];
  blockReasons: string[];
};

function haystack(input: {
  title: string;
  description?: string | null;
  topics?: string[];
}): string {
  const topics = (input.topics ?? []).join(" ");
  return [input.title, input.description, topics]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function countMatches(text: string, patterns: string[]): number {
  let n = 0;
  for (const p of patterns) {
    if (text.includes(p.toLowerCase())) {
      n += 1;
    }
  }
  return n;
}

export function assessGithubPublishingRelevance(input: {
  title: string;
  description?: string | null;
  topics?: string[];
  /** 来自 publishing_ai scope 的 GitHub topic 源可略放宽 */
  strict?: boolean;
}): GithubPublishingRelevanceResult {
  const text = haystack(input);
  const reasons: string[] = [];
  const blockReasons: string[] = [];

  if (!text.trim()) {
    return { pass: false, confidence: 0, reasons: ["empty"], blockReasons: ["empty"] };
  }

  for (const p of BLOCK_PATTERNS) {
    if (text.includes(p)) {
      blockReasons.push(`block:${p}`);
    }
  }

  const pubHits = countMatches(text, PUBLISHING_PATTERNS);
  const aiHits = countMatches(text, AI_PATTERNS);

  if (pubHits > 0) {
    reasons.push(`publishing_keywords:${pubHits}`);
  }
  if (aiHits > 0) {
    reasons.push(`ai_keywords:${aiHits}`);
  }

  if (blockReasons.length > 0 && pubHits === 0) {
    return { pass: false, confidence: 0.1, reasons, blockReasons };
  }

  const strict = input.strict ?? true;
  let confidence = 0.2;
  if (pubHits > 0 && aiHits > 0) {
    confidence = 0.85;
  } else if (pubHits >= 2) {
    confidence = 0.7;
  } else if (pubHits === 1 && aiHits === 0) {
    confidence = strict ? 0.45 : 0.55;
  } else if (aiHits >= 2 && pubHits === 0) {
    confidence = 0.35;
  } else if (aiHits === 1) {
    confidence = 0.25;
  }

  const pass = strict
    ? confidence >= 0.5 && blockReasons.length === 0
    : confidence >= 0.45 && blockReasons.length === 0;

  return { pass, confidence, reasons, blockReasons };
}

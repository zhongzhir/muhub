import { PUBLISHING_KEYWORD_TO_TAGS } from "@/lib/discovery/classification/keyword-rules";

const PUBLISHING_PATTERNS = PUBLISHING_KEYWORD_TO_TAGS.flatMap((r) => r.patterns);

const AI_PATTERNS = [
  " ai ",
  "ai-",
  "artificial intelligence",
  "machine learning",
  " llm",
  "gpt",
  "generative",
  "nlp",
  "chatgpt",
  "openai",
  "agent",
  "automation",
  "deep learning",
  "writing assistant",
  "text generation",
  "notebooklm",
  "elevenlabs",
  "audiobook",
];

export type PublishingContentFilterResult = {
  pass: boolean;
  confidence: number;
  reasons: string[];
  filterSignals: string[];
};

export function filterPublishingRelevantContent(input: {
  title: string;
  summary?: string | null;
  rawText?: string | null;
  /** @deprecated 使用 filterMode；默认 relaxed */
  requireAiHint?: boolean;
  filterMode?: "relaxed" | "strict";
}): PublishingContentFilterResult {
  const haystack = [input.title, input.summary, input.rawText]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) {
    return { pass: false, confidence: 0, reasons: ["empty_content"], filterSignals: ["filter:empty"] };
  }

  const filterSignals: string[] = [];
  const hasPublishing = PUBLISHING_PATTERNS.some((p) => haystack.includes(p.toLowerCase()));
  const hasAi = AI_PATTERNS.some((p) => haystack.includes(p.toLowerCase()));
  const hasGithub = /github\.com\/[^\s]+/i.test(haystack);
  const hasToolLaunch =
    /(launch|launches|open-source|open source|introducing|announces|发布|上线|工具)/i.test(haystack);

  if (hasPublishing) {
    filterSignals.push("publishing_keyword");
  }
  if (hasAi) {
    filterSignals.push("ai_keyword");
  }
  if (hasGithub) {
    filterSignals.push("github_url");
  }
  if (hasToolLaunch) {
    filterSignals.push("tool_launch_hint");
  }

  const mode =
    input.filterMode ??
    (input.requireAiHint === true ? "strict" : "relaxed");

  const reasons: string[] = [];
  if (hasPublishing) {
    reasons.push("publishing_context");
  }
  if (hasAi) {
    reasons.push("ai_context");
  }
  if (hasGithub) {
    reasons.push("github_link");
  }
  if (hasToolLaunch) {
    reasons.push("product_launch_language");
  }

  let confidence = 0.25;
  if (hasPublishing && hasAi) {
    confidence = 0.9;
  } else if (hasPublishing && hasGithub) {
    confidence = 0.85;
  } else if (hasPublishing && hasToolLaunch) {
    confidence = 0.75;
  } else if (hasPublishing) {
    confidence = 0.55;
  } else if (hasAi && hasToolLaunch) {
    confidence = 0.65;
  } else if (hasAi) {
    confidence = 0.45;
  }

  const pass =
    mode === "strict"
      ? hasPublishing && hasAi
      : hasPublishing || hasAi || (hasGithub && hasToolLaunch);

  return { pass, confidence, reasons, filterSignals };
}

/** @deprecated 兼容旧调用 */
export function isPublishingRssContentFilterEnabled(): boolean {
  return true;
}

import { normalizeChineseExpression } from "@/lib/zh-normalization";

export const MAX_NORMALIZED_TAGS = 8;

/** 常见英文/变体 → 中文标签映射（手工维护，非机翻） */
export const CHINESE_TAG_MAP: Record<string, string> = {
  "voice-cloning": "声音克隆",
  "voice cloning": "声音克隆",
  "voice clone": "声音克隆",
  voiceclone: "声音克隆",
  cloning: "声音克隆",
  "text-to-speech": "文本转语音",
  "text to speech": "文本转语音",
  tts: "文本转语音",
  speech: "语音",
  "speech synthesis": "语音合成",
  multilingual: "多语言",
  multi_lingual: "多语言",
  "multi-lingual": "多语言",
  "ai-agent": "AI智能体",
  "ai agent": "AI智能体",
  "ai agents": "AI智能体",
  agent: "AI智能体",
  "video-generation": "视频生成",
  "video generation": "视频生成",
  "image-generation": "图像生成",
  "image generation": "图像生成",
  "developer-tool": "开发工具",
  "developer tool": "开发工具",
  "developer tools": "开发工具",
  "open-source": "开源",
  "open source": "开源",
  opensource: "开源",
  dubbing: "AI配音",
  "ai dubbing": "AI配音",
  "voice generation": "语音生成",
  "voice over": "配音",
  transcription: "语音转写",
  "speech-to-text": "语音转写",
  stt: "语音转写",
  workflow: "工作流",
  automation: "自动化",
  orchestration: "任务编排",
  chatbot: "聊天机器人",
  copilot: "Copilot",
  llm: "大语言模型",
  rag: "RAG",
  api: "API",
  saas: "SaaS",
  freemium: "免费增值",
  chrome: "Chrome扩展",
  "chrome extension": "Chrome扩展",
  ios: "iOS",
  android: "Android",
  wechat: "微信",
  github: "GitHub",
  producthunt: "Product Hunt",
};

const GENERIC_LOW_VALUE_TAGS = new Set([
  "creator",
  "creators",
  "marketer",
  "marketers",
  "marketing",
  "future",
  "innovative",
  "innovation",
  "platform",
  "platforms",
  "solution",
  "solutions",
  "tool",
  "tools",
  "app",
  "apps",
  "software",
  "product",
  "products",
  "service",
  "services",
  "startup",
  "business",
  "enterprise",
  "user",
  "users",
  "team",
  "teams",
  "digital",
  "online",
  "modern",
  "smart",
  "powerful",
  "best",
  "new",
  "hot",
  "trending",
]);

const BRAND_PRESERVE_PATTERN =
  /^(?:[A-Z0-9]{2,}(?:\.[A-Z0-9]+)?|GitHub|Product Hunt|Copilot|ChatGPT|OpenAI|Midjourney|Stable Diffusion|RAG|SaaS|API|iOS|Android|Chrome)$/;

export type TagNormalizerContext = {
  projectName?: string | null;
  description?: string | null;
  techSignals?: string[];
  useCases?: string[];
};

function normalizeTagKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function preserveBrandOrTechnical(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (BRAND_PRESERVE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (/^[A-Z][a-zA-Z0-9+.]*$/.test(trimmed) && trimmed.length <= 24) {
    return trimmed;
  }
  return null;
}

export function mapTagToChinese(raw: string): string {
  const trimmed = normalizeChineseExpression(raw);
  if (!trimmed) {
    return "";
  }
  if (hasChinese(trimmed)) {
    return trimmed;
  }
  const key = normalizeTagKey(trimmed);
  for (const [mapKey, mapValue] of Object.entries(CHINESE_TAG_MAP)) {
    if (normalizeTagKey(mapKey) === key) {
      return mapValue;
    }
  }
  const preserved = preserveBrandOrTechnical(trimmed);
  if (preserved) {
    return preserved;
  }
  return trimmed;
}

export function semanticTagScore(tag: string, context?: TagNormalizerContext): number {
  const key = normalizeTagKey(tag);
  const lower = tag.trim().toLowerCase();
  if (!lower) {
    return 0;
  }
  if (GENERIC_LOW_VALUE_TAGS.has(lower) || GENERIC_LOW_VALUE_TAGS.has(key.replace(/-/g, ""))) {
    const contextText = [
      context?.projectName,
      context?.description,
      ...(context?.techSignals ?? []),
      ...(context?.useCases ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (lower === "creator" && /creator|创作|博主|up主/.test(contextText)) {
      return 35;
    }
    if (lower === "marketer" && /market|营销|投放/.test(contextText)) {
      return 35;
    }
    return 8;
  }
  if (CHINESE_TAG_MAP[key] || hasChinese(tag)) {
    return 90;
  }
  if (preserveBrandOrTechnical(tag)) {
    return 70;
  }
  if (lower.includes("ai") || lower.includes("voice") || lower.includes("speech")) {
    return 75;
  }
  if (lower.split("-").length >= 2) {
    return 55;
  }
  return 40;
}

export function dedupeNormalizedTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const chinese = mapTagToChinese(tag);
    if (!chinese) {
      continue;
    }
    const dedupeKey = normalizeTagKey(chinese).replace(/-/g, "");
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    out.push(chinese);
  }
  return out;
}

export function filterSemanticTags(
  tags: string[],
  context?: TagNormalizerContext,
  minScore = 30,
): string[] {
  return tags.filter((tag) => semanticTagScore(tag, context) >= minScore);
}

function inferVoiceDomainTags(tags: string[], context?: TagNormalizerContext): string[] {
  const text = [
    context?.projectName,
    context?.description,
    ...(context?.techSignals ?? []),
    ...tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const out = [...tags];
  const has = (label: string) => out.some((tag) => tag.includes(label));
  if (/voice|tts|speech|clone|配音|语音/.test(text)) {
    if (!has("语音生成")) out.push("语音生成");
    if (!has("配音") && !has("AI配音")) out.push("AI配音");
    if (/multilingual|多语言/.test(text) && !has("多语言")) out.push("多语言");
  }
  return out;
}

export function normalizedChineseTags(
  inputTags: string[],
  context?: TagNormalizerContext,
): string[] {
  const deduped = dedupeNormalizedTags(inputTags);
  const scored = deduped
    .map((tag) => ({ tag, score: semanticTagScore(tag, context) }))
    .filter((item) => item.score >= 30)
    .sort((a, b) => b.score - a.score);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of scored) {
    const key = normalizeTagKey(item.tag).replace(/-/g, "");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item.tag);
    if (out.length >= MAX_NORMALIZED_TAGS) {
      break;
    }
  }
  return inferVoiceDomainTags(out, context).slice(0, MAX_NORMALIZED_TAGS);
}

export function normalizedChineseTagsFromKnowledge(input: {
  tags?: string[];
  targetUsers?: string[];
  techSignals?: string[];
  projectName?: string | null;
  description?: string | null;
  useCases?: string[];
}): string[] {
  const merged = [
    ...(input.tags ?? []),
    ...(input.targetUsers ?? []),
    ...(input.techSignals ?? []),
  ];
  return normalizedChineseTags(merged, {
    projectName: input.projectName,
    description: input.description,
    techSignals: input.techSignals,
    useCases: input.useCases,
  });
}

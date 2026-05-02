import { normalizePrimaryCategoryToSlug, PROJECT_CATEGORY_OPTIONS } from "@/lib/projects/project-categories";
import { normalizeChineseExpression, normalizeChineseList } from "@/lib/zh-normalization";

const TAG_DICT: Record<string, string> = {
  automation: "\u81ea\u52a8\u5316",
  workflow: "\u5de5\u4f5c\u6d41",
  orchestration: "\u7f16\u6392",
  agent: "\u667a\u80fd\u4f53",
  agents: "\u667a\u80fd\u4f53",
  "ai agent": "AI Agent",
  "ai agents": "AI Agent",
  "open source": "\u5f00\u6e90",
  opensource: "\u5f00\u6e90",
  "developer tool": "\u5f00\u53d1\u8005\u5de5\u5177",
  "developer tools": "\u5f00\u53d1\u8005\u5de5\u5177",
  productivity: "\u6548\u7387\u5de5\u5177",
  enterprise: "\u4f01\u4e1a\u670d\u52a1",
  "business automation": "\u4f01\u4e1a\u81ea\u52a8\u5316",
  "knowledge base": "\u77e5\u8bc6\u5e93",
  "customer support": "\u5ba2\u670d",
  marketing: "\u8425\u9500",
  content: "\u5185\u5bb9",
  analytics: "\u6570\u636e\u5206\u6790",
};

const CATEGORY_DICT: Record<string, string> = {
  "ai agents": "ai_agent",
  "ai agent": "ai_agent",
  "ai \u667a\u80fd\u4f53": "ai_agent",
  "ai \u4e0e\u667a\u80fd\u4f53": "ai_agent",
  agent: "ai_agent",
  agents: "ai_agent",
  llm: "ai_agent",
  "ai / llm": "ai_agent",
  "ai/llm": "ai_agent",
  "\u5927\u6a21\u578b": "ai_agent",

  "developer tools": "developer_tool",
  "developer tool": "developer_tool",
  "dev tool": "developer_tool",
  devtool: "developer_tool",
  "\u5f00\u53d1\u8005\u5de5\u5177": "developer_tool",

  "open source": "open_source",
  opensource: "open_source",
  oss: "open_source",
  "\u5f00\u6e90": "open_source",
  "\u5f00\u6e90\u9879\u76ee": "open_source",

  research: "research",
  "\u7814\u7a76": "research",
  "\u7814\u7a76\u9879\u76ee": "research",

  infra: "infrastructure",
  infrastructure: "infrastructure",
  "\u57fa\u7840\u8bbe\u65bd": "infrastructure",

  datasets: "data_model",
  dataset: "data_model",
  "data model": "data_model",
  "\u6570\u636e\u96c6": "data_model",
  "\u6570\u636e\u4e0e\u6a21\u578b": "data_model",

  design: "design_creative",
  "design tool": "design_creative",
  "\u8bbe\u8ba1": "design_creative",
  "\u8bbe\u8ba1\u5de5\u5177": "design_creative",
  "\u8bbe\u8ba1\u4e0e\u521b\u610f\u5de5\u5177": "design_creative",

  productivity: "productivity",
  automation: "productivity",
  "\u6548\u7387\u5de5\u5177": "productivity",
  "\u6548\u7387\u4e0e\u529e\u516c\u5de5\u5177": "productivity",
  "\u5de5\u4f5c\u6d41": "productivity",

  content: "content_media",
  media: "content_media",
  "\u5185\u5bb9": "content_media",
  "\u5185\u5bb9\u4e0e\u5a92\u4f53": "content_media",

  culture: "culture_art",
  art: "culture_art",
  "\u6587\u5316": "culture_art",
  "\u827a\u672f": "culture_art",
  "\u6587\u5316\u4e0e\u827a\u672f": "culture_art",

  education: "education_learning",
  learning: "education_learning",
  books: "education_learning",
  "\u6559\u80b2": "education_learning",
  "\u5b66\u4e60": "education_learning",
  "\u6559\u5b66": "education_learning",
  "\u4e66\u7c4d": "education_learning",

  consumer: "consumer_brand",
  brand: "consumer_brand",
  "\u6d88\u8d39\u54c1\u724c": "consumer_brand",

  ecommerce: "ecommerce_local",
  local: "ecommerce_local",
  "\u7535\u5546": "ecommerce_local",
  "\u672c\u5730\u751f\u6d3b": "ecommerce_local",

  travel: "travel_event",
  event: "travel_event",
  "\u6587\u65c5": "travel_event",
  "\u6d3b\u52a8": "travel_event",

  community: "community",
  "\u793e\u533a": "community",
  "\u793e\u7fa4": "community",

  enterprise: "enterprise_service",
  "enterprise service": "enterprise_service",
  "\u4f01\u4e1a\u670d\u52a1": "enterprise_service",

  finance: "finance_investment",
  investment: "finance_investment",
  "\u91d1\u878d": "finance_investment",
  "\u6295\u8d44": "finance_investment",

  health: "health_medical",
  medical: "health_medical",
  "\u5065\u5eb7": "health_medical",
  "\u533b\u7597": "health_medical",

  hardware: "hardware_robotics",
  robotics: "hardware_robotics",
  robot: "hardware_robotics",
  "\u786c\u4ef6": "hardware_robotics",
  "\u673a\u5668\u4eba": "hardware_robotics",

  game: "game_entertainment",
  entertainment: "game_entertainment",
  "\u6e38\u620f": "game_entertainment",
  "\u5a31\u4e50": "game_entertainment",

  other: "other",
  "\u5176\u4ed6": "other",

  "ai-agents": "ai_agent",
  "developer-tools": "developer_tool",
  "open-source": "open_source",
};

const CATEGORY_ZH_LABEL: Record<string, string> = Object.fromEntries(
  PROJECT_CATEGORY_OPTIONS.map((item) => [item.value, item.label]),
);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTagItem(value: string): string {
  const v = normalizeChineseExpression(value);
  const key = normalizeKey(v);
  return TAG_DICT[key] ?? v;
}

export function normalizeSuggestedTags(inputTags: string[]): string[] {
  const normalized = normalizeChineseList(inputTags.map(normalizeTagItem));
  return normalized.slice(0, 8);
}

function normalizeCategoryItem(value: string): string {
  const text = normalizeChineseExpression(value);
  if (!text) return "";
  const bySlug = normalizePrimaryCategoryToSlug(text);
  if (bySlug) return bySlug;
  const mapped = CATEGORY_DICT[normalizeKey(text)];
  if (mapped) return mapped;
  const fromLabel = PROJECT_CATEGORY_OPTIONS.find((item) => item.label.toLowerCase() === text.toLowerCase());
  return fromLabel?.value ?? text;
}

export function normalizeSuggestedCategories(input: {
  primary?: string;
  secondary?: string;
  optional?: string[];
}) {
  const primary = normalizeCategoryItem(input.primary ?? "");
  const secondary = normalizeCategoryItem(input.secondary ?? "");
  const optional = normalizeChineseList((input.optional ?? []).map(normalizeCategoryItem)).slice(0, 8);
  return {
    primary: primary || undefined,
    secondary: secondary || undefined,
    optional,
  };
}

export function categoryDisplayLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const slug = normalizePrimaryCategoryToSlug(value);
  if (slug) return CATEGORY_ZH_LABEL[slug] ?? slug;
  return value;
}

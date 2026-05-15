export const PROJECT_CATEGORIES = [
  "ai_agent",
  "developer_tool",
  "open_source",
  "research",
  "infrastructure",
  "data_model",
  "design_creative",
  "productivity",
  "content_media",
  "culture_art",
  "education_learning",
  "consumer_brand",
  "ecommerce_local",
  "travel_event",
  "community",
  "enterprise_service",
  "finance_investment",
  "health_medical",
  "hardware_robotics",
  "game_entertainment",
  "publishing_media",
  "other",
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  ai_agent: "AI \u4e0e\u667a\u80fd\u4f53",
  developer_tool: "\u5f00\u53d1\u8005\u5de5\u5177",
  open_source: "\u5f00\u6e90\u9879\u76ee",
  research: "\u7814\u7a76\u9879\u76ee",
  infrastructure: "\u57fa\u7840\u8bbe\u65bd",
  data_model: "\u6570\u636e\u4e0e\u6a21\u578b",
  design_creative: "\u8bbe\u8ba1\u4e0e\u521b\u610f\u5de5\u5177",
  productivity: "\u6548\u7387\u4e0e\u529e\u516c\u5de5\u5177",
  content_media: "\u5185\u5bb9\u4e0e\u5a92\u4f53",
  culture_art: "\u6587\u5316\u4e0e\u827a\u672f",
  education_learning: "\u6559\u80b2\u4e0e\u5b66\u4e60",
  consumer_brand: "\u6d88\u8d39\u54c1\u724c",
  ecommerce_local: "\u7535\u5546\u4e0e\u672c\u5730\u751f\u6d3b",
  travel_event: "\u6587\u65c5\u4e0e\u6d3b\u52a8",
  community: "\u793e\u533a\u4e0e\u793e\u7fa4",
  enterprise_service: "\u4f01\u4e1a\u670d\u52a1",
  finance_investment: "\u91d1\u878d\u4e0e\u6295\u8d44",
  health_medical: "\u5065\u5eb7\u4e0e\u533b\u7597",
  hardware_robotics: "\u786c\u4ef6\u4e0e\u673a\u5668\u4eba",
  game_entertainment: "\u6e38\u620f\u4e0e\u5a31\u4e50",
  publishing_media: "\u51fa\u7248\u4e0e\u4f20\u5a92",
  other: "\u5176\u4ed6",
};

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  "ai-agents": "AI \u4e0e\u667a\u80fd\u4f53",
  "developer-tools": "\u5f00\u53d1\u8005\u5de5\u5177",
  "open-source": "\u5f00\u6e90\u9879\u76ee",
  infra: "\u57fa\u7840\u8bbe\u65bd",
  datasets: "\u6570\u636e\u4e0e\u6a21\u578b",
  design: "\u8bbe\u8ba1\u4e0e\u521b\u610f\u5de5\u5177",
};

export const PROJECT_CATEGORY_OPTIONS: Array<{ value: ProjectCategory; label: string }> =
  PROJECT_CATEGORIES.map((value) => ({
    value,
    label: PROJECT_CATEGORY_LABELS[value],
  }));

export function isProjectCategory(value: string | null | undefined): value is ProjectCategory {
  if (!value) {
    return false;
  }
  return (PROJECT_CATEGORIES as readonly string[]).includes(value);
}

const LEGACY_CLASSIFICATION_PRIMARY_TO_SLUG: Record<string, ProjectCategory> = {
  "ai-agents": "ai_agent",
  "ai agent": "ai_agent",
  "ai agents": "ai_agent",
  "ai \u667a\u80fd\u4f53": "ai_agent",
  "ai \u4e0e\u667a\u80fd\u4f53": "ai_agent",
  agent: "ai_agent",
  agents: "ai_agent",
  llm: "ai_agent",
  "ai / llm": "ai_agent",
  "ai/llm": "ai_agent",
  "\u5927\u6a21\u578b": "ai_agent",

  "developer-tools": "developer_tool",
  "developer tool": "developer_tool",
  "developer tools": "developer_tool",
  devtool: "developer_tool",
  "dev tool": "developer_tool",
  "\u5f00\u53d1\u8005\u5de5\u5177": "developer_tool",

  "open-source": "open_source",
  "open source": "open_source",
  opensource: "open_source",
  oss: "open_source",
  "\u5f00\u6e90\u9879\u76ee": "open_source",
  "\u5f00\u6e90": "open_source",

  infra: "infrastructure",
  infrastructure: "infrastructure",
  "model / infra": "infrastructure",
  "model/infra": "infrastructure",
  "\u57fa\u7840\u8bbe\u65bd": "infrastructure",

  datasets: "data_model",
  dataset: "data_model",
  "data model": "data_model",
  "data/model": "data_model",
  "rag tool": "data_model",
  "\u6570\u636e\u96c6": "data_model",
  "\u6570\u636e\u4e0e\u6a21\u578b": "data_model",

  design: "design_creative",
  "design tool": "design_creative",
  "\u8bbe\u8ba1\u5de5\u5177": "design_creative",
  "\u8bbe\u8ba1\u4e0e\u521b\u610f\u5de5\u5177": "design_creative",

  "workflow tool": "productivity",
  productivity: "productivity",
  "\u6548\u7387\u5de5\u5177": "productivity",
  "\u6548\u7387\u4e0e\u529e\u516c\u5de5\u5177": "productivity",

  content: "content_media",
  media: "content_media",
  "content media": "content_media",
  "\u5185\u5bb9": "content_media",
  "\u5185\u5bb9\u4e0e\u5a92\u4f53": "content_media",

  education: "education_learning",
  learning: "education_learning",
  "\u6559\u80b2": "education_learning",
  "\u5b66\u4e60": "education_learning",
  "\u6559\u80b2\u4e0e\u5b66\u4e60": "education_learning",

  enterprise: "enterprise_service",
  "enterprise service": "enterprise_service",
  "\u4f01\u4e1a\u670d\u52a1": "enterprise_service",

  "media ai": "content_media",
  "general ai tool": "ai_agent",
  // \u51fa\u7248\u4e0e\u4f20\u5a92
  publishing: "publishing_media",
  "publishing media": "publishing_media",
  other: "other",
  "\u5176\u4ed6": "other",
};

export function normalizePrimaryCategoryToSlug(raw: string | null | undefined): ProjectCategory | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === "uncategorized" || trimmed === "\u672a\u5206\u7c7b") {
    return null;
  }
  if (isProjectCategory(trimmed)) {
    return trimmed;
  }
  const key = trimmed.toLowerCase().replace(/\s+/g, " ");
  const mapped = LEGACY_CLASSIFICATION_PRIMARY_TO_SLUG[key];
  if (mapped) {
    return mapped;
  }
  const fromLabel = PROJECT_CATEGORY_OPTIONS.find(
    (o) => o.label.trim().toLowerCase().replace(/\s+/g, " ") === key,
  );
  return fromLabel?.value ?? null;
}

export function getProjectCategoryLabel(
  category: string | null | undefined,
  fallback = "\u5176\u4ed6",
): string {
  if (!category?.trim()) {
    return fallback;
  }
  const key = category.trim();
  if (isProjectCategory(key)) {
    return PROJECT_CATEGORY_LABELS[key];
  }
  const legacy = LEGACY_CATEGORY_LABELS[key];
  if (legacy) {
    return legacy;
  }
  const normalized = normalizePrimaryCategoryToSlug(key);
  if (normalized) {
    return PROJECT_CATEGORY_LABELS[normalized];
  }
  return key;
}

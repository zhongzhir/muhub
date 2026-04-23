import { normalizePrimaryCategoryToSlug, PROJECT_CATEGORY_OPTIONS } from "@/lib/projects/project-categories";
import { normalizeChineseExpression, normalizeChineseList } from "@/lib/zh-normalization";

const TAG_DICT: Record<string, string> = {
  automation: "自动化",
  workflow: "工作流",
  orchestration: "编排",
  agent: "智能体",
  agents: "智能体",
  "ai agent": "AI Agent",
  "ai agents": "AI Agent",
  "open source": "开源",
  opensource: "开源",
  "developer tool": "开发工具",
  "developer tools": "开发工具",
  productivity: "效率工具",
  enterprise: "企业服务",
  "business automation": "企业自动化",
  "knowledge base": "知识库",
  "customer support": "客服",
  marketing: "营销",
  content: "内容",
  analytics: "数据分析",
};

const CATEGORY_DICT: Record<string, string> = {
  "ai agents": "ai-agents",
  "ai agent": "ai-agents",
  agent: "ai-agents",
  agents: "ai-agents",
  "developer tools": "developer-tools",
  "developer tool": "developer-tools",
  "open source": "open-source",
  opensource: "open-source",
  productivity: "productivity",
  research: "research",
  infra: "infra",
  datasets: "datasets",
  design: "design",
  other: "other",
  "开发工具": "developer-tools",
  "开源": "open-source",
  "智能体": "ai-agents",
  "效率工具": "productivity",
  llm: "ai-agents",
  "大模型": "ai-agents",
  "llm基础": "ai-agents",
  "ai / llm": "ai-agents",
  "ai/llm": "ai-agents",
  automation: "productivity",
  "自动化": "productivity",
  "workflow automation": "productivity",
  orchestration: "productivity",
  content: "design",
  "内容": "design",
  education: "research",
  "学习": "research",
  "教学": "research",
  books: "research",
  "书籍": "research",
  "dev tool": "developer-tools",
};

const CATEGORY_ZH_LABEL: Record<string, string> = {
  "ai-agents": "AI 智能体",
  "developer-tools": "开发工具",
  "open-source": "开源",
  research: "研究",
  infra: "基础设施",
  datasets: "数据集",
  design: "设计",
  productivity: "效率工具",
  other: "其他",
};

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
  return CATEGORY_ZH_LABEL[value] ?? value;
}

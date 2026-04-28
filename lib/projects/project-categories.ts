export const PROJECT_CATEGORIES = [
  "ai-agents",
  "developer-tools",
  "open-source",
  "research",
  "infra",
  "datasets",
  "design",
  "productivity",
  "other",
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

const PROJECT_CATEGORY_LABELS: Record<ProjectCategory, string> = {
  "ai-agents": "AI 智能体",
  "developer-tools": "开发者工具",
  "open-source": "开源项目",
  research: "研究项目",
  infra: "基础设施",
  datasets: "数据集",
  design: "设计工具",
  productivity: "效率工具",
  other: "其他",
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

/**
 * Discovery / 关键词分类写入的「主类型」可读串（见 keyword-rules PRIMARY_TYPE_ORDER），
 * 与前台/运营下拉使用的 slug（PROJECT_CATEGORIES）不一致时需映射。
 */
const LEGACY_CLASSIFICATION_PRIMARY_TO_SLUG: Record<string, ProjectCategory> = {
  "ai agent": "ai-agents",
  "ai agents": "ai-agents",
  "workflow tool": "productivity",
  "rag tool": "datasets",
  devtool: "developer-tools",
  "developer tools": "developer-tools",
  "model / infra": "infra",
  "model/infra": "infra",
  "media ai": "other",
  "general ai tool": "other",
};

/**
 * 将数据库或表单中的分类字符串归一为 `PROJECT_CATEGORIES` 中的 slug。
 * 空串、仅空白、「未分类」占位视为未选择（null）。
 */
export function normalizePrimaryCategoryToSlug(raw: string | null | undefined): ProjectCategory | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
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
  fallback = "其他",
): string {
  if (!category?.trim()) {
    return fallback;
  }
  const key = category.trim();
  if (isProjectCategory(key)) {
    return PROJECT_CATEGORY_LABELS[key];
  }
  return key;
}

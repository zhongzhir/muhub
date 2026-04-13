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
  "ai-agents": "AI Agents",
  "developer-tools": "Developer Tools",
  "open-source": "Open Source",
  research: "Research",
  infra: "Infra",
  datasets: "Datasets",
  design: "Design",
  productivity: "Productivity",
  other: "Other",
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

export function getProjectCategoryLabel(
  category: string | null | undefined,
  fallback = "Other",
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

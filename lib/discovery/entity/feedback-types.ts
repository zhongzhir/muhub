export const ENTITY_HINT_FEEDBACK_ACTIONS = [
  "ACCEPT",
  "REJECT",
  "UNSURE",
  "RETYPE",
  "CHANGE_PRIMARY_SOURCE",
  "NEEDS_REVIEW",
] as const;
export type EntityHintFeedbackAction = (typeof ENTITY_HINT_FEEDBACK_ACTIONS)[number];

export const ENTITY_HINT_FEEDBACK_REVIEWERS = [
  "system",
  "expert",
  "founder",
  "operator",
] as const;
export type EntityHintFeedbackReviewer = (typeof ENTITY_HINT_FEEDBACK_REVIEWERS)[number];

export const ENTITY_HINT_FEEDBACK_TAGS = [
  "official_source_exists",
  "github_exists",
  "huggingface_exists",
  "website_exists",
  "multi_source_verified",
  "high_project_value",
  "high_industry_attention",
  "concept_only",
  "method_only",
  "no_official_source",
  "ambiguous_name",
  "duplicate_project",
  "insufficient_information",
  "ai_misidentified",
  "found_more_trusted_source",
  "official_source",
  "github_source",
  "huggingface_source",
  "website_source",
  "other",
  "real_company",
  "real_lab",
  "navigation_noise",
  "generic_concept",
  "conference_entity",
  "policy_related",
  "publishing_ai",
  "high_signal",
  "low_quality",
  "duplicate",
] as const;
export type EntityHintFeedbackTag = (typeof ENTITY_HINT_FEEDBACK_TAGS)[number];

export function isEntityHintFeedbackAction(value: string): value is EntityHintFeedbackAction {
  return (ENTITY_HINT_FEEDBACK_ACTIONS as readonly string[]).includes(value);
}

export function isEntityHintFeedbackReviewer(value: string): value is EntityHintFeedbackReviewer {
  return (ENTITY_HINT_FEEDBACK_REVIEWERS as readonly string[]).includes(value);
}

export function parseFeedbackTags(raw: unknown): EntityHintFeedbackTag[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (t): t is EntityHintFeedbackTag =>
      typeof t === "string" &&
      (ENTITY_HINT_FEEDBACK_TAGS as readonly string[]).includes(t),
  );
}

export function hintStatusForFeedbackAction(action: EntityHintFeedbackAction): string | null {
  if (action === "ACCEPT") {
    return "ACCEPTED";
  }
  if (action === "REJECT") {
    return "REJECTED";
  }
  if (action === "NEEDS_REVIEW" || action === "UNSURE") {
    return "PENDING";
  }
  return null;
}

export const FEEDBACK_TAG_LABELS: Record<EntityHintFeedbackTag, string> = {
  official_source_exists: "官方来源存在",
  github_exists: "GitHub存在",
  huggingface_exists: "HuggingFace存在",
  website_exists: "官网存在",
  multi_source_verified: "多源验证",
  high_project_value: "项目价值高",
  high_industry_attention: "行业关注度高",
  concept_only: "只是概念",
  method_only: "只是方法",
  no_official_source: "没有官方来源",
  ambiguous_name: "名称歧义",
  duplicate_project: "重复项目",
  insufficient_information: "信息不足",
  ai_misidentified: "AI误识别",
  found_more_trusted_source: "找到更可信来源",
  official_source: "官方来源",
  github_source: "GitHub来源",
  huggingface_source: "HuggingFace来源",
  website_source: "官网来源",
  other: "其它",
  real_company: "真实公司",
  real_lab: "真实实验室",
  navigation_noise: "导航噪声",
  generic_concept: "泛概念",
  conference_entity: "会议实体",
  policy_related: "政策相关",
  publishing_ai: "出版AI",
  high_signal: "高质量信号",
  low_quality: "低质量",
  duplicate: "重复",
};

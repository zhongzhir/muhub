export const ENTITY_HINT_FEEDBACK_ACTIONS = [
  "ACCEPT",
  "REJECT",
  "UNSURE",
  "RETYPE",
  "CHANGE_PRIMARY_SOURCE",
  "MERGE",
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

export const EXPERT_FEEDBACK_V2_TAGS = [
  "has_primary_source",
  "github_verified",
  "huggingface_verified",
  "official_website",
  "official_docs",
  "multiple_sources",
  "project_like_resource",
  "high_industry_relevance",
  "publishing_ai_relevant",
  "generic_organization",
  "sentence_fragment",
  "article_topic_only",
  "no_primary_source",
  "irrelevant",
  "project_to_dataset",
  "project_to_model",
  "organization_to_project",
  "concept_to_tool",
  "type_boundary_corrected",
  "source_should_be_primary",
  "article_is_secondary",
  "found_github",
  "found_huggingface",
  "found_official_site",
  "found_docs",
  "source_cross_verified",
  "same_entity",
  "alias",
  "parent_child_resource",
  "duplicate_source",
  "same_organization",
] as const;

export const ENTITY_HINT_FEEDBACK_TAGS = [
  ...EXPERT_FEEDBACK_V2_TAGS,
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

const EXPERT_FEEDBACK_V2_TAG_LABELS: Record<(typeof EXPERT_FEEDBACK_V2_TAGS)[number], string> = {
  has_primary_source: "has primary source",
  github_verified: "GitHub verified",
  huggingface_verified: "HuggingFace verified",
  official_website: "official website",
  official_docs: "official docs",
  multiple_sources: "multiple sources",
  project_like_resource: "project-like resource",
  high_industry_relevance: "high industry relevance",
  publishing_ai_relevant: "publishing AI relevant",
  generic_organization: "generic organization",
  sentence_fragment: "sentence fragment",
  article_topic_only: "article topic only",
  no_primary_source: "no primary source",
  irrelevant: "irrelevant",
  project_to_dataset: "project to dataset",
  project_to_model: "project to model",
  organization_to_project: "organization to project",
  concept_to_tool: "concept to tool",
  type_boundary_corrected: "type boundary corrected",
  source_should_be_primary: "source should be primary",
  article_is_secondary: "article is secondary",
  found_github: "found GitHub",
  found_huggingface: "found HuggingFace",
  found_official_site: "found official site",
  found_docs: "found docs",
  source_cross_verified: "source cross verified",
  same_entity: "same entity",
  alias: "alias",
  parent_child_resource: "parent-child resource",
  duplicate_source: "duplicate source",
  same_organization: "same organization",
};

export const FEEDBACK_TAG_LABELS: Record<EntityHintFeedbackTag, string> = {
  ...EXPERT_FEEDBACK_V2_TAG_LABELS,
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

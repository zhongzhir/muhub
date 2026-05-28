/**
 * Entity Discovery E1.6 — Feedback 类型与常量
 */

export const ENTITY_HINT_FEEDBACK_ACTIONS = ["ACCEPT", "REJECT", "UNSURE"] as const;
export type EntityHintFeedbackAction = (typeof ENTITY_HINT_FEEDBACK_ACTIONS)[number];

export const ENTITY_HINT_FEEDBACK_REVIEWERS = [
  "system",
  "expert",
  "founder",
  "operator",
] as const;
export type EntityHintFeedbackReviewer = (typeof ENTITY_HINT_FEEDBACK_REVIEWERS)[number];

export const ENTITY_HINT_FEEDBACK_TAGS = [
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
  return null;
}

export const FEEDBACK_TAG_LABELS: Record<EntityHintFeedbackTag, string> = {
  real_company: "真实公司",
  real_lab: "真实实验室",
  navigation_noise: "导航噪声",
  generic_concept: "泛概念",
  conference_entity: "会议实体",
  policy_related: "政策相关",
  publishing_ai: "出版×AI",
  high_signal: "高信号",
  low_quality: "低质量",
  duplicate: "重复",
};

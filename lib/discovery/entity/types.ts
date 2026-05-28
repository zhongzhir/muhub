/**
 * Entity Discovery E1 — 类型与常量
 */

export const ENTITY_HINT_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "MERGED_LATER",
] as const;

export type EntityHintStatus = (typeof ENTITY_HINT_STATUSES)[number];

export const ENTITY_TYPES = [
  "PROJECT",
  "ORGANIZATION",
  "LAB",
  "TOOL",
  "PLATFORM",
  "COMPANY",
  "DATASET",
  "EVENT",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export type SourceAuthorityTier =
  | "regulatory"
  | "industry_association"
  | "institution"
  | "media"
  | "community"
  | "unknown";

export type EntityHintEvidence = {
  extractionMethod: "rule" | "ai" | "signal_field";
  ruleId?: string;
  sourceAuthorityTier?: SourceAuthorityTier;
  signalType?: string;
  sourceType?: string;
  context?: string;
  aiModel?: string;
  skippedReason?: string;
  /** E1.5 AI Entity Judge */
  judge?: "ai_entity_judge";
  sourceText?: string;
  matchedKeywords?: string[];
  publishingAiRelevance?: number;
  aiReason?: string;
  aiEvidence?: string;
  model?: string;
  createdBy?: string;
  pageUrl?: string;
};

export type ExtractedEntityHintDraft = {
  name: string;
  entityType: string;
  confidence: number;
  reason: string;
  sourceTextSnippet?: string;
  evidenceJson: EntityHintEvidence;
};

export type EntityHintExtractionResult = {
  hints: ExtractedEntityHintDraft[];
  skippedReason?: string;
  skipStats?: {
    skippedNavigation: number;
    skippedGeneric: number;
    skippedLowQuality: number;
  };
};

export type PersistEntityHintsResult = {
  extracted: number;
  skipped: number;
  duplicate: number;
  errors: string[];
};

export function isEntityHintStatus(value: string): value is EntityHintStatus {
  return (ENTITY_HINT_STATUSES as readonly string[]).includes(value);
}

export function parseSourceAuthorityTier(configJson: unknown): SourceAuthorityTier {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return "unknown";
  }
  const raw = (configJson as Record<string, unknown>).sourceAuthorityTier;
  if (typeof raw !== "string") {
    return "unknown";
  }
  const tier = raw.trim().toLowerCase();
  if (
    tier === "regulatory" ||
    tier === "industry_association" ||
    tier === "institution" ||
    tier === "media" ||
    tier === "community"
  ) {
    return tier;
  }
  return "unknown";
}

export function authorityTierBoost(tier: SourceAuthorityTier): number {
  switch (tier) {
    case "regulatory":
      return 0.15;
    case "industry_association":
      return 0.1;
    case "institution":
      return 0.08;
    case "media":
      return 0.05;
    case "community":
      return 0.02;
    default:
      return 0;
  }
}

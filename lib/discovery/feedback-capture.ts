import { randomUUID } from "crypto";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const DISCOVERY_FEEDBACK_DATASET_PATH = path.join(
  process.cwd(),
  "data",
  "entity-feedback-dataset.jsonl",
);

export const DISCOVERY_FEEDBACK_DECISIONS = [
  "ACCEPT",
  "REJECT",
  "RETYPE",
  "CHANGE_PRIMARY_SOURCE",
  "MERGE",
  "NEEDS_REVIEW",
] as const;

export type DiscoveryFeedbackDecision = (typeof DISCOVERY_FEEDBACK_DECISIONS)[number];

export const DISCOVERY_FEEDBACK_REASON_TAGS = [
  "has_primary_source",
  "github_verified",
  "huggingface_verified",
  "official_website",
  "official_docs",
  "multiple_sources",
  "project_like_resource",
  "high_industry_relevance",
  "publishing_ai_relevant",
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
  "generic_organization",
  "sentence_fragment",
  "article_topic_only",
  "no_primary_source",
  "duplicate",
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
  "found_more_trusted_source",
  "official_source",
  "github_source",
  "huggingface_source",
  "website_source",
  "other",
] as const;

export type DiscoveryFeedbackReasonTag = (typeof DISCOVERY_FEEDBACK_REASON_TAGS)[number];

export type DiscoveryFeedbackRecord = {
  id: string;
  timestamp: string;
  entityHintId?: string | null;
  entityName: string;
  originalEntityType: string | null;
  finalEntityType: string | null;
  originalStatus?: string | null;
  finalStatus?: string | null;
  originalDecision: string | null;
  finalDecision: DiscoveryFeedbackDecision;
  originalPrimarySource: string | null;
  finalPrimarySource: string | null;
  mergeTarget?: string | null;
  primarySourceOverride?: {
    url?: string | null;
    sourceLevel?: string | null;
    reason?: string | null;
  } | null;
  expertComment?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceLevel?: string | null;
  isHumanDecision?: boolean;
  decisionSource?: "entity_queue" | "discovery_candidate" | "project_import_review" | "system_rule";
  reasonTags: DiscoveryFeedbackReasonTag[];
  comment: string | null;
  authenticityScore: number | null;
  operator: string | null;
  context?: {
    discoveryCandidateId?: string | null;
    discoveryItemId?: string | null;
    targetProjectId?: string | null;
    source?: "discovery_candidate" | "discovery_item" | "project_import_review";
  };
  evidence?: Array<{
    url: string;
    sourceLevel?: string | null;
    evidenceRole?: string | null;
  }>;
};

export type SubmitDiscoveryFeedbackInput = Omit<DiscoveryFeedbackRecord, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

function isDecision(value: string): value is DiscoveryFeedbackDecision {
  return (DISCOVERY_FEEDBACK_DECISIONS as readonly string[]).includes(value);
}

function normalizeReasonTags(raw: unknown): DiscoveryFeedbackReasonTag[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<DiscoveryFeedbackReasonTag>();
  for (const item of raw) {
    if (
      typeof item === "string" &&
      (DISCOVERY_FEEDBACK_REASON_TAGS as readonly string[]).includes(item)
    ) {
      seen.add(item as DiscoveryFeedbackReasonTag);
    }
  }
  return Array.from(seen);
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, value));
}

export function createDiscoveryFeedbackRecord(
  input: SubmitDiscoveryFeedbackInput,
): DiscoveryFeedbackRecord {
  if (!isDecision(input.finalDecision)) {
    throw new Error(`Invalid feedback decision: ${input.finalDecision}`);
  }

  const entityName = cleanString(input.entityName);
  if (!entityName) {
    throw new Error("entityName is required");
  }

  return {
    id: cleanString(input.id) ?? randomUUID(),
    timestamp: cleanString(input.timestamp) ?? new Date().toISOString(),
    entityHintId: cleanString(input.entityHintId),
    entityName,
    originalEntityType: cleanString(input.originalEntityType),
    finalEntityType: cleanString(input.finalEntityType),
    originalStatus: cleanString(input.originalStatus),
    finalStatus: cleanString(input.finalStatus),
    originalDecision: cleanString(input.originalDecision),
    finalDecision: input.finalDecision,
    originalPrimarySource: cleanString(input.originalPrimarySource),
    finalPrimarySource: cleanString(input.finalPrimarySource),
    mergeTarget: cleanString(input.mergeTarget),
    primarySourceOverride: input.primarySourceOverride
      ? {
          url: cleanString(input.primarySourceOverride.url),
          sourceLevel: cleanString(input.primarySourceOverride.sourceLevel),
          reason: cleanString(input.primarySourceOverride.reason),
        }
      : undefined,
    expertComment: cleanString(input.expertComment),
    sourceUrl: cleanString(input.sourceUrl),
    sourceTitle: cleanString(input.sourceTitle),
    sourceLevel: cleanString(input.sourceLevel),
    isHumanDecision: input.isHumanDecision === false ? false : input.isHumanDecision === true ? true : undefined,
    decisionSource: input.decisionSource,
    reasonTags: normalizeReasonTags(input.reasonTags),
    comment: cleanString(input.comment),
    authenticityScore: cleanScore(input.authenticityScore),
    operator: cleanString(input.operator),
    context: input.context
      ? {
          discoveryCandidateId: cleanString(input.context.discoveryCandidateId),
          discoveryItemId: cleanString(input.context.discoveryItemId),
          targetProjectId: cleanString(input.context.targetProjectId),
          source: input.context.source,
        }
      : undefined,
    evidence: Array.isArray(input.evidence)
      ? input.evidence
          .map((item) => ({
            url: cleanString(item.url),
            sourceLevel: cleanString(item.sourceLevel),
            evidenceRole: cleanString(item.evidenceRole),
          }))
          .filter((item): item is { url: string; sourceLevel: string | null; evidenceRole: string | null } =>
            Boolean(item.url),
          )
      : undefined,
  };
}

export async function appendDiscoveryFeedbackRecord(
  input: SubmitDiscoveryFeedbackInput,
): Promise<DiscoveryFeedbackRecord> {
  const record = createDiscoveryFeedbackRecord(input);
  await persistDiscoveryFeedbackRecord(record);
  return record;
}

type DiscoveryFeedbackDbRow = {
  id: string;
  createdAt: Date;
  entityHintId: string | null;
  entityName: string;
  originalEntityType: string | null;
  finalEntityType: string | null;
  originalStatus: string | null;
  finalStatus: string | null;
  decision: string;
  reasonTags: Prisma.JsonValue | null;
  comment: string | null;
  operator: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  isHumanDecision: boolean;
  decisionSource: string | null;
  authenticityScore: number | null;
  metadata: Prisma.JsonValue | null;
};

function jsonParam(value: unknown): Prisma.Sql {
  return Prisma.sql`${JSON.stringify(value ?? null)}::jsonb`;
}

function metadataForRecord(record: DiscoveryFeedbackRecord): Record<string, unknown> {
  return {
    timestamp: record.timestamp,
    originalDecision: record.originalDecision,
    originalPrimarySource: record.originalPrimarySource,
    finalPrimarySource: record.finalPrimarySource,
    mergeTarget: record.mergeTarget ?? null,
    primarySourceOverride: record.primarySourceOverride ?? null,
    expertComment: record.expertComment ?? null,
    sourceLevel: record.sourceLevel,
    context: record.context ?? null,
    evidence: record.evidence ?? null,
  };
}

export async function persistDiscoveryFeedbackRecord(
  record: DiscoveryFeedbackRecord,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const createdAt = new Date(record.timestamp);
  const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
  await db.$executeRaw`
    INSERT INTO "DiscoveryFeedback" (
      "id",
      "createdAt",
      "entityHintId",
      "entityName",
      "originalEntityType",
      "finalEntityType",
      "originalStatus",
      "finalStatus",
      "decision",
      "reasonTags",
      "comment",
      "operator",
      "sourceUrl",
      "sourceTitle",
      "isHumanDecision",
      "decisionSource",
      "authenticityScore",
      "metadata"
    )
    VALUES (
      ${record.id},
      ${safeCreatedAt},
      ${record.entityHintId ?? null},
      ${record.entityName},
      ${record.originalEntityType},
      ${record.finalEntityType},
      ${record.originalStatus ?? null},
      ${record.finalStatus ?? null},
      ${record.finalDecision},
      ${jsonParam(record.reasonTags)},
      ${record.comment},
      ${record.operator},
      ${record.sourceUrl ?? null},
      ${record.sourceTitle ?? null},
      ${record.isHumanDecision === false ? false : true},
      ${record.decisionSource ?? null},
      ${record.authenticityScore},
      ${jsonParam(metadataForRecord(record))}
    )
    ON CONFLICT ("id") DO NOTHING
  `;
}

function metadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function stringFromMetadata(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function contextFromMetadata(value: unknown): DiscoveryFeedbackRecord["context"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const source = raw.source;
  return {
    discoveryCandidateId: cleanString(raw.discoveryCandidateId),
    discoveryItemId: cleanString(raw.discoveryItemId),
    targetProjectId: cleanString(raw.targetProjectId),
    source:
      source === "discovery_candidate" ||
      source === "discovery_item" ||
      source === "project_import_review"
        ? source
        : undefined,
  };
}

function evidenceFromMetadata(value: unknown): DiscoveryFeedbackRecord["evidence"] {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const raw = item as Record<string, unknown>;
      const url = cleanString(raw.url);
      return url
        ? {
            url,
            sourceLevel: cleanString(raw.sourceLevel),
            evidenceRole: cleanString(raw.evidenceRole),
          }
        : null;
    })
    .filter((item): item is { url: string; sourceLevel: string | null; evidenceRole: string | null } =>
      Boolean(item),
    );
}

function discoveryFeedbackRowToRecord(row: DiscoveryFeedbackDbRow): DiscoveryFeedbackRecord {
  const metadata = metadataObject(row.metadata);
  const decisionSource = row.decisionSource;
  return {
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    entityHintId: row.entityHintId,
    entityName: row.entityName,
    originalEntityType: row.originalEntityType,
    finalEntityType: row.finalEntityType,
    originalStatus: row.originalStatus,
    finalStatus: row.finalStatus,
    originalDecision: stringFromMetadata(metadata, "originalDecision"),
    finalDecision: isDecision(row.decision) ? row.decision : "NEEDS_REVIEW",
    originalPrimarySource: stringFromMetadata(metadata, "originalPrimarySource"),
    finalPrimarySource: stringFromMetadata(metadata, "finalPrimarySource"),
    mergeTarget: stringFromMetadata(metadata, "mergeTarget"),
    primarySourceOverride:
      metadata.primarySourceOverride &&
      typeof metadata.primarySourceOverride === "object" &&
      !Array.isArray(metadata.primarySourceOverride)
        ? (metadata.primarySourceOverride as DiscoveryFeedbackRecord["primarySourceOverride"])
        : undefined,
    expertComment: stringFromMetadata(metadata, "expertComment"),
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    sourceLevel: stringFromMetadata(metadata, "sourceLevel"),
    isHumanDecision: row.isHumanDecision,
    decisionSource:
      decisionSource === "entity_queue" ||
      decisionSource === "discovery_candidate" ||
      decisionSource === "project_import_review" ||
      decisionSource === "system_rule"
        ? decisionSource
        : undefined,
    reasonTags: normalizeReasonTags(row.reasonTags),
    comment: row.comment,
    authenticityScore: row.authenticityScore,
    operator: row.operator,
    context: contextFromMetadata(metadata.context),
    evidence: evidenceFromMetadata(metadata.evidence),
  };
}

export async function readDiscoveryFeedbackRecords(limit = 100): Promise<DiscoveryFeedbackRecord[]> {
  try {
    const rows = await prisma.$queryRaw<DiscoveryFeedbackDbRow[]>`
      SELECT
        "id",
        "createdAt",
        "entityHintId",
        "entityName",
        "originalEntityType",
        "finalEntityType",
        "originalStatus",
        "finalStatus",
        "decision",
        "reasonTags",
        "comment",
        "operator",
        "sourceUrl",
        "sourceTitle",
        "isHumanDecision",
        "decisionSource",
        "authenticityScore",
        "metadata"
      FROM "DiscoveryFeedback"
      ORDER BY "createdAt" DESC
      LIMIT ${Math.max(1, limit)}
    `;
    return rows.map(discoveryFeedbackRowToRecord);
  } catch {
    return [];
  }
}

export function isVerificationFeedbackRecord(record: DiscoveryFeedbackRecord): boolean {
  return (
    record.operator === "operator-verification" ||
    record.comment?.startsWith("verification_") ||
    record.comment?.toLowerCase().includes("verification") ||
    record.operator === "admin-data-fix"
  );
}

export function isHumanFeedbackRecord(record: DiscoveryFeedbackRecord): boolean {
  if (record.isHumanDecision === true) {
    return true;
  }
  if (record.isHumanDecision === false || record.decisionSource === "system_rule") {
    return false;
  }
  return (
    (record.context?.source === "discovery_item" ||
      record.context?.source === "discovery_candidate" ||
      record.decisionSource === "entity_queue" ||
      record.decisionSource === "discovery_candidate" ||
      record.decisionSource === "project_import_review") &&
    !isVerificationFeedbackRecord(record)
  );
}

export function summarizeDiscoveryFeedback(records: DiscoveryFeedbackRecord[]) {
  const byDecision = new Map<string, number>();
  const rejectReasons = new Map<string, number>();
  const retypeReasons = new Map<string, number>();
  const sourceChangeReasons = new Map<string, number>();

  for (const record of records) {
    byDecision.set(record.finalDecision, (byDecision.get(record.finalDecision) ?? 0) + 1);
    const target =
      record.finalDecision === "REJECT"
        ? rejectReasons
        : record.finalDecision === "RETYPE"
          ? retypeReasons
          : record.finalDecision === "CHANGE_PRIMARY_SOURCE"
            ? sourceChangeReasons
            : null;
    if (target) {
      for (const tag of record.reasonTags) {
        target.set(tag, (target.get(tag) ?? 0) + 1);
      }
    }
  }

  const top = (map: Map<string, number>) =>
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

  return {
    byDecision: Object.fromEntries(byDecision.entries()),
    topRejectReasons: top(rejectReasons),
    topRetypeReasons: top(retypeReasons),
    topSourceChanges: top(sourceChangeReasons),
  };
}

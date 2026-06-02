import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

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
  await mkdir(path.dirname(DISCOVERY_FEEDBACK_DATASET_PATH), { recursive: true });
  await writeFile(
    DISCOVERY_FEEDBACK_DATASET_PATH,
    `${JSON.stringify(record)}\n`,
    { encoding: "utf8", flag: "a" },
  );
  return record;
}

export async function readDiscoveryFeedbackRecords(limit = 100): Promise<DiscoveryFeedbackRecord[]> {
  let text = "";
  try {
    text = await readFile(DISCOVERY_FEEDBACK_DATASET_PATH, "utf8");
  } catch {
    return [];
  }

  const rows: DiscoveryFeedbackRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as DiscoveryFeedbackRecord;
      if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
        rows.push(parsed);
      }
    } catch {
      // Ignore malformed legacy rows so the viewer stays usable.
    }
  }

  return rows
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, Math.max(1, limit));
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
  return record.context?.source === "discovery_item" && !isVerificationFeedbackRecord(record);
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

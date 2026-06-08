#!/usr/bin/env tsx
/**
 * Import legacy data/entity-feedback-dataset.jsonl rows into DiscoveryFeedback.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-entity-feedback-jsonl-to-db.ts
 *   pnpm tsx scripts/migrate-entity-feedback-jsonl-to-db.ts --in data/entity-feedback-dataset.jsonl
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createDiscoveryFeedbackRecord,
  persistDiscoveryFeedbackRecord,
  type SubmitDiscoveryFeedbackInput,
} from "@/lib/discovery/feedback-capture";
import { prisma } from "@/lib/prisma";

function parseArgs(argv: string[]): { input: string; dryRun: boolean } {
  let input = path.join("data", "entity-feedback-dataset.jsonl");
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--in" && argv[i + 1]) {
      input = argv[i + 1]!.trim();
      i += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return { input, dryRun };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toInput(row: Record<string, unknown>): SubmitDiscoveryFeedbackInput {
  const context = asObject(row.context);
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : undefined,
    entityHintId: typeof row.entityHintId === "string" ? row.entityHintId : null,
    entityName: typeof row.entityName === "string" ? row.entityName : "Unknown entity",
    originalEntityType: typeof row.originalEntityType === "string" ? row.originalEntityType : null,
    finalEntityType: typeof row.finalEntityType === "string" ? row.finalEntityType : null,
    originalStatus: typeof row.originalStatus === "string" ? row.originalStatus : null,
    finalStatus: typeof row.finalStatus === "string" ? row.finalStatus : null,
    originalDecision: typeof row.originalDecision === "string" ? row.originalDecision : null,
    finalDecision:
      row.finalDecision === "ACCEPT" ||
      row.finalDecision === "REJECT" ||
      row.finalDecision === "RETYPE" ||
      row.finalDecision === "CHANGE_PRIMARY_SOURCE" ||
      row.finalDecision === "MERGE" ||
      row.finalDecision === "NEEDS_REVIEW"
        ? row.finalDecision
        : "NEEDS_REVIEW",
    originalPrimarySource:
      typeof row.originalPrimarySource === "string" ? row.originalPrimarySource : null,
    finalPrimarySource: typeof row.finalPrimarySource === "string" ? row.finalPrimarySource : null,
    sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl : null,
    sourceTitle: typeof row.sourceTitle === "string" ? row.sourceTitle : null,
    sourceLevel: typeof row.sourceLevel === "string" ? row.sourceLevel : null,
    isHumanDecision: typeof row.isHumanDecision === "boolean" ? row.isHumanDecision : undefined,
    decisionSource:
      row.decisionSource === "entity_queue" ||
      row.decisionSource === "discovery_candidate" ||
      row.decisionSource === "project_import_review" ||
      row.decisionSource === "system_rule"
        ? row.decisionSource
        : undefined,
    reasonTags: Array.isArray(row.reasonTags) ? row.reasonTags : [],
    comment: typeof row.comment === "string" ? row.comment : null,
    authenticityScore: typeof row.authenticityScore === "number" ? row.authenticityScore : null,
    operator: typeof row.operator === "string" ? row.operator : null,
    context: context
      ? {
          discoveryCandidateId:
            typeof context.discoveryCandidateId === "string" ? context.discoveryCandidateId : null,
          discoveryItemId: typeof context.discoveryItemId === "string" ? context.discoveryItemId : null,
          targetProjectId: typeof context.targetProjectId === "string" ? context.targetProjectId : null,
          source:
            context.source === "discovery_candidate" ||
            context.source === "discovery_item" ||
            context.source === "project_import_review"
              ? context.source
              : undefined,
        }
      : undefined,
    evidence: Array.isArray(row.evidence)
      ? row.evidence
          .map((item) => {
            const raw = asObject(item);
            return typeof raw?.url === "string"
              ? {
                  url: raw.url,
                  sourceLevel: typeof raw.sourceLevel === "string" ? raw.sourceLevel : null,
                  evidenceRole: typeof raw.evidenceRole === "string" ? raw.evidenceRole : null,
                }
              : null;
          })
          .filter(
            (item): item is { url: string; sourceLevel: string | null; evidenceRole: string | null } =>
              Boolean(item),
          )
      : undefined,
  };
}

async function main(): Promise<void> {
  const { input, dryRun } = parseArgs(process.argv.slice(2));
  const text = await readFile(input, "utf8");
  let parsed = 0;
  let imported = 0;
  let skipped = 0;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    parsed += 1;
    try {
      const row = asObject(JSON.parse(trimmed));
      if (!row) {
        skipped += 1;
        continue;
      }
      const record = createDiscoveryFeedbackRecord(toInput(row));
      if (!dryRun) {
        await persistDiscoveryFeedbackRecord(record);
      }
      imported += 1;
    } catch {
      skipped += 1;
    }
  }

  console.log(JSON.stringify({ ok: true, input, dryRun, parsed, imported, skipped }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

#!/usr/bin/env tsx
/**
 * Entity Discovery E1 / E1.5 — 批量从 DiscoverySignal 抽取 EntityHint
 *
 * 用法：
 *   pnpm tsx scripts/extract-entity-hints.ts --scope publishing_ai --limit 50
 *   pnpm tsx scripts/extract-entity-hints.ts --scope publishing_ai --limit 50 --force --ai-judge
 *   pnpm tsx scripts/extract-entity-hints.ts --dry-run --limit 10
 *   pnpm tsx scripts/extract-entity-hints.ts --signal-id <id>
 *   pnpm tsx scripts/extract-entity-hints.ts --no-ai
 *   pnpm tsx scripts/extract-entity-hints.ts --no-ai-judge
 *   pnpm tsx scripts/extract-entity-hints.ts --min-confidence 0.75 --min-relevance 0.60
 *
 * 需设置：
 *   ENTITY_DISCOVERY_ENABLED=true
 *   ENTITY_HINT_EXTRACTION_ENABLED=true
 */

import { batchExtractEntityHints } from "../lib/discovery/entity/persist-hints";
import { isEntityHintExtractionEnabled } from "../lib/discovery/discovery-feature-flags";
import type { DiscoveryScope } from "../lib/discovery/discovery-scopes";
import { isDiscoveryScope } from "../lib/discovery/discovery-scopes";
import { prisma } from "../lib/prisma";

function parseArgs(argv: string[]): {
  scope?: DiscoveryScope;
  limit: number;
  dryRun: boolean;
  useAi: boolean;
  useAiJudge?: boolean;
  noAiJudge: boolean;
  minConfidence: number;
  minRelevance: number;
  signalId?: string;
  force: boolean;
} {
  let scope: DiscoveryScope | undefined;
  let limit = 50;
  let dryRun = false;
  let useAi = true;
  let useAiJudge: boolean | undefined;
  let noAiJudge = false;
  let minConfidence = 0.75;
  let minRelevance = 0.6;
  let signalId: string | undefined;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scope" && argv[i + 1]) {
      const raw = argv[i + 1]!.trim();
      if (isDiscoveryScope(raw)) {
        scope = raw;
      } else {
        console.error(`Invalid scope: ${raw}`);
        process.exit(1);
      }
      i += 1;
    } else if (arg === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number(argv[i + 1]) || 50);
      i += 1;
    } else if (arg === "--min-confidence" && argv[i + 1]) {
      minConfidence = Number(argv[i + 1]) || 0.75;
      i += 1;
    } else if (arg === "--min-relevance" && argv[i + 1]) {
      minRelevance = Number(argv[i + 1]) || 0.6;
      i += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-ai") {
      useAi = false;
    } else if (arg === "--ai-judge") {
      useAiJudge = true;
    } else if (arg === "--no-ai-judge") {
      noAiJudge = true;
    } else if (arg === "--signal-id" && argv[i + 1]) {
      signalId = argv[i + 1]!.trim();
      i += 1;
    } else if (arg === "--force") {
      force = true;
    }
  }

  return {
    scope,
    limit,
    dryRun,
    useAi,
    useAiJudge,
    noAiJudge,
    minConfidence,
    minRelevance,
    signalId,
    force,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.force && !isEntityHintExtractionEnabled()) {
    console.warn(
      "Entity hint extraction is disabled. Set ENTITY_DISCOVERY_ENABLED=true and ENTITY_HINT_EXTRACTION_ENABLED=true, or pass --force.",
    );
    if (!args.force) {
      process.exit(1);
    }
  }

  console.log("Entity Hint extraction starting...", {
    scope: args.scope ?? "(all)",
    limit: args.limit,
    dryRun: args.dryRun,
    useAi: args.useAi,
    useAiJudge: args.useAiJudge ?? "(auto for WEBSITE_SCAN)",
    noAiJudge: args.noAiJudge,
    minConfidence: args.minConfidence,
    minRelevance: args.minRelevance,
    signalId: args.signalId ?? null,
    force: args.force,
  });

  const result = await batchExtractEntityHints({
    scope: args.scope,
    limit: args.limit,
    dryRun: args.dryRun,
    useAi: args.useAi,
    useAiJudge: args.useAiJudge,
    noAiJudge: args.noAiJudge,
    minConfidence: args.minConfidence,
    minRelevance: args.minRelevance,
    signalId: args.signalId,
    force: args.force,
  });

  console.log("\n--- Result ---");
  console.log(JSON.stringify(result, null, 2));

  if (!args.dryRun) {
    const total = await prisma.entityHint.count();
    const pending = await prisma.entityHint.count({ where: { status: "PENDING" } });
    const hints = await prisma.entityHint.findMany({
      select: { evidenceJson: true },
    });
    const aiJudgeCount = hints.filter(
      (h) =>
        h.evidenceJson &&
        typeof h.evidenceJson === "object" &&
        !Array.isArray(h.evidenceJson) &&
        (h.evidenceJson as Record<string, unknown>).judge === "ai_entity_judge",
    ).length;
    console.log("\n--- EntityHint totals ---");
    console.log({ total, pending, aiJudgeCount });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

#!/usr/bin/env tsx
/**
 * Entity Discovery E1 — 批量从 DiscoverySignal 抽取 EntityHint
 *
 * 用法：
 *   pnpm tsx scripts/extract-entity-hints.ts --scope publishing_ai --limit 50
 *   pnpm tsx scripts/extract-entity-hints.ts --dry-run --limit 10
 *   pnpm tsx scripts/extract-entity-hints.ts --signal-id <id>
 *   pnpm tsx scripts/extract-entity-hints.ts --no-ai
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
  signalId?: string;
  force: boolean;
} {
  let scope: DiscoveryScope | undefined;
  let limit = 50;
  let dryRun = false;
  let useAi = true;
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
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-ai") {
      useAi = false;
    } else if (arg === "--signal-id" && argv[i + 1]) {
      signalId = argv[i + 1]!.trim();
      i += 1;
    } else if (arg === "--force") {
      force = true;
    }
  }

  return { scope, limit, dryRun, useAi, signalId, force };
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
    signalId: args.signalId ?? null,
    force: args.force,
  });

  const result = await batchExtractEntityHints({
    scope: args.scope,
    limit: args.limit,
    dryRun: args.dryRun,
    useAi: args.useAi,
    signalId: args.signalId,
    force: args.force,
  });

  console.log("\n--- Result ---");
  console.log(JSON.stringify(result, null, 2));

  if (!args.dryRun) {
    const total = await prisma.entityHint.count();
    const pending = await prisma.entityHint.count({ where: { status: "PENDING" } });
    console.log("\n--- EntityHint totals ---");
    console.log({ total, pending });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

#!/usr/bin/env tsx
/**
 * Entity Discovery E1.6 — 导出 Feedback Learning 数据集（JSONL）
 *
 * 用法：
 *   pnpm tsx scripts/export-entity-feedback-dataset.ts
 *   pnpm tsx scripts/export-entity-feedback-dataset.ts --out data/entity-feedback.jsonl
 *   pnpm tsx scripts/export-entity-feedback-dataset.ts --limit 500
 */

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { readDiscoveryFeedbackRecords } from "@/lib/discovery/feedback-capture";
import { prisma } from "@/lib/prisma";

function parseArgs(argv: string[]): { out: string; limit: number } {
  let out = path.join("data", "entity-feedback-dataset.jsonl");
  let limit = 5000;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) {
      out = argv[i + 1]!.trim();
      i += 1;
    } else if (arg === "--limit" && argv[i + 1]) {
      limit = Math.max(1, Number(argv[i + 1]) || 5000);
      i += 1;
    }
  }

  return { out, limit };
}

async function main(): Promise<void> {
  const { out, limit } = parseArgs(process.argv.slice(2));
  const rows = await readDiscoveryFeedbackRecords(limit);

  await mkdir(path.dirname(out), { recursive: true });

  const stream = createWriteStream(out, { encoding: "utf8" });
  for (const row of rows) {
    stream.write(`${JSON.stringify(row)}\n`);
  }

  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on("error", reject);
  });

  const total = rows.length;
  console.log(
    JSON.stringify(
      {
        ok: true,
        exported: rows.length,
        totalFeedbackRows: total,
        outPath: out,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

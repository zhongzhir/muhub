/**
 * Project official-info enrichment and public-signal tracking prototype.
 *
 * Run with:
 *   pnpm run tracker:official-info
 *
 * Environment:
 * - DATABASE_URL required
 * - TRACKER_LIMIT optional, default 50
 * - TRACKER_SPACING_MS optional, default 800
 * - AI_API_KEY / AI_MODEL / AI_BASE_URL, or DeepSeek fallbacks
 */

import { trackAllProjectsOfficialInfo } from "@/lib/project-tracker/track-official-info";

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[tracker:official-info] Missing DATABASE_URL.");
    process.exit(1);
  }

  const limit = readPositiveIntEnv("TRACKER_LIMIT", 50);
  const spacingMs = readPositiveIntEnv("TRACKER_SPACING_MS", 800);

  console.log("[tracker:official-info] job=project-official-info-tracker-v1");
  console.log("[tracker:official-info] label=项目官方信息补全与公开信号跟踪雏形");
  console.log(`[tracker:official-info] limit=${limit} spacingMs=${spacingMs}`);
  console.log(`[tracker:official-info] startedAt=${new Date().toISOString()}\n`);

  const result = await trackAllProjectsOfficialInfo({
    limit,
    onlyMissingSource: true,
    spacingMs,
  });

  console.log("\n========== tracker:official-info completed ==========");
  console.log(`checked=${result.examined}`);
  console.log(`updated=${result.updated}`);
  console.log(`skipped=${result.skipped}`);
  console.log(`errors=${result.errors.length}`);

  if (result.gaps.length > 0) {
    console.log("\n[tracker:official-info] gaps preview:");
    for (const gap of result.gaps.slice(0, 20)) {
      console.log(`  - ${gap.name} (${gap.slug}): missing=${gap.missingFields.join(", ")}`);
    }
  }

  if (result.errors.length > 0) {
    console.warn("\n[tracker:official-info] error details:");
    for (const err of result.errors) {
      console.warn(`  ! ${err}`);
    }
  }

  console.log(`\n[tracker:official-info] finishedAt=${new Date().toISOString()}`);
  process.exit(0);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[tracker:official-info] fatal=${message}`);
  process.exit(1);
});

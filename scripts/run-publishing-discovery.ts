/**
 * 批量运行 publishing_ai Discovery 来源
 *
 * 运行：pnpm tsx scripts/run-publishing-discovery.ts
 * 可选：pnpm tsx scripts/run-publishing-discovery.ts publishing-github-topics
 */

import {
  countPublishingAiProjects,
  listPublishingDiscoverySourceKeys,
  runPublishingDiscoveryPipeline,
} from "@/lib/discovery/publishing/publishing-discovery-pipeline";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[run:publishing-discovery] DATABASE_URL 未配置");
    process.exit(1);
  }

  const argKeys = process.argv.slice(2).filter(Boolean);
  const before = await countPublishingAiProjects();
  console.log(`[run:publishing-discovery] publishing_ai 项目覆盖（估算）: ${before}`);

  const available = await listPublishingDiscoverySourceKeys();
  console.log(`[run:publishing-discovery] 可用来源 (${available.length}): ${available.join(", ")}`);

  const summary = await runPublishingDiscoveryPipeline({
    sourceKeys: argKeys.length > 0 ? argKeys : undefined,
    delayMs: 800,
  });

  console.log("\n[run:publishing-discovery] 运行结果:");
  for (const run of summary.runs) {
    const status = run.ok ? "OK" : "FAIL";
    console.log(
      `  [${status}] ${run.key} run=${run.runId} fetched=${run.fetchedCount} parsed=${run.parsedCount} new=${run.newCandidateCount} updated=${run.updatedCandidateCount}${run.error ? ` err=${run.error}` : ""}`,
    );
  }

  const after = await countPublishingAiProjects();
  console.log(`\n[run:publishing-discovery] 完成 ok=${summary.ok} 项目覆盖 ${before} → ${after}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

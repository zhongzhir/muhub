/**
 * 同步 chinese-independent-developer 主板项目到 Discovery JSON 队列。
 *
 * 默认仅收录 README.md（主板），不包含程序员版 / 游戏版。
 *
 * 示例：
 * pnpm run discovery:chinese-indie
 *   等价于 EDITION=main pnpm run discovery:chinese-indie
 *
 * DRY_RUN=1 pnpm run discovery:chinese-indie
 *   预检主板，输出 estimatedAutoImportable
 *
 * LIMIT=50 pnpm run discovery:chinese-indie
 *   小批量主板入队
 *
 * OFFSET=100 LIMIT=20 pnpm run discovery:chinese-indie
 *   跳过前 100 条后再取 20 条（避免头部 duplicate）
 *
 * AUTO_IMPORT=1 LIMIT=20 pnpm run discovery:chinese-indie
 * AUTO_IMPORT=1 OFFSET=100 LIMIT=5 pnpm run discovery:chinese-indie
 *   小批量自动上架（需 AI enrichment 全部成功）
 *
 * EDITION=programmer DRY_RUN=1 pnpm run discovery:chinese-indie
 * EDITION=game DRY_RUN=1 pnpm run discovery:chinese-indie
 *   程序员版 / 游戏版须显式指定，且不会进入默认自动上架
 */

import {
  CHINESE_INDIE_DEFAULT_EDITION,
  CHINESE_INDIE_EXCLUDED_FILES,
  CHINESE_INDIE_FILES,
} from "@/lib/discovery/sources/chinese-independent-developer";
import {
  runChineseIndependentDeveloperImport,
  type RunChineseIndependentDeveloperImportResult,
} from "@/lib/discovery/sources/run-chinese-independent-developer-import";
import type { ChineseIndieEdition } from "@/lib/discovery/sources/chinese-independent-developer";

function readEdition(): ChineseIndieEdition | "all" {
  const raw = (process.env.EDITION ?? CHINESE_INDIE_DEFAULT_EDITION).trim().toLowerCase();
  if (raw === "main" || raw === "programmer" || raw === "game" || raw === "all") {
    return raw;
  }
  throw new Error(`无效的 EDITION=${raw}，可选：main | programmer | game | all`);
}

function readLimit(): number | undefined {
  const raw = process.env.LIMIT?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`无效的 LIMIT=${raw}`);
  }
  return Math.floor(parsed);
}

function readOffset(): number {
  const raw = process.env.OFFSET?.trim();
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`无效的 OFFSET=${raw}`);
  }
  return Math.floor(parsed);
}

function printSummary(result: RunChineseIndependentDeveloperImportResult): void {
  console.log("\n=== chinese-independent-developer V2 同步结果 ===");
  console.log(`dryRun: ${result.dryRun ? "yes" : "no"}`);
  console.log(`autoImport: ${result.autoImport ? "yes" : "no"}`);
  console.log(`edition: ${result.edition}`);
  console.log(`offset: ${result.offset}`);
  console.log(`limit: ${result.limit ?? "none"}`);
  console.log(`selectedRange: ${result.selectedRange} (${result.selectedCount} entries)`);
  console.log(`includedFiles: ${result.includedFiles.join(", ") || CHINESE_INDIE_FILES.main}`);
  if (result.excludedFiles.length > 0) {
    console.log(`excludedFiles: ${result.excludedFiles.join(", ")}`);
  } else if (result.edition === "main") {
    console.log(`excludedFiles: ${CHINESE_INDIE_EXCLUDED_FILES.join(", ")}`);
  }
  console.log(`fetched files: ${result.fetched}`);
  console.log(`parsed entries: ${result.parsed}`);
  console.log(
    `parsed by edition: main=${result.parsedByEdition.main}, programmer=${result.parsedByEdition.programmer}, game=${result.parsedByEdition.game}`,
  );
  console.log(
    `queue stats: queued=${result.queued}, duplicates=${result.duplicates.length}, skippedClosed=${result.skippedClosed}, skippedInvalid=${result.skippedInvalid}, failed=${result.failed}`,
  );
  if (result.dryRun) {
    console.log(`estimatedAutoImportable: ${result.estimatedAutoImportable}`);
  }
  if (result.autoImport) {
    console.log(
      `import stats: imported=${result.imported}, aiSucceeded=${result.aiSucceeded}, aiFailed=${result.aiFailed}, needsReview=${result.needsReview}, importSkipped=${result.importSkipped}, importFailed=${result.importFailed}`,
    );
    if (result.importedSlugs.length > 0) {
      console.log(`imported slugs: ${result.importedSlugs.join(", ")}`);
    }
    if (result.needsReviewTitles.length > 0) {
      console.log(`needsReview titles: ${result.needsReviewTitles.join(", ")}`);
    }
  }
  if (result.fetchErrors.length > 0) {
    console.log("\nfetch errors:");
    for (const error of result.fetchErrors) {
      console.log(`- [${error.edition}] ${error.fileName}: ${error.error}`);
    }
  }
  if (result.sampleDuplicates.length > 0) {
    console.log("\nduplicate examples:");
    for (const dup of result.sampleDuplicates) {
      console.log(
        `- ${dup.name} (${dup.edition}) -> /projects/${dup.existingSlug || "?"} (${dup.reason})`,
      );
    }
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[discovery:chinese-indie] 未设置 DATABASE_URL");
    process.exit(1);
  }

  const dryRun = process.env.DRY_RUN === "1";
  const autoImport = process.env.AUTO_IMPORT === "1";
  const edition = readEdition();
  const limit = readLimit();
  const offset = readOffset();

  console.log(
    `[discovery:chinese-indie] start dryRun=${dryRun} autoImport=${autoImport} edition=${edition} offset=${offset} limit=${limit ?? "none"}`,
  );

  const result = await runChineseIndependentDeveloperImport({
    dryRun,
    autoImport: dryRun ? false : autoImport,
    edition,
    offset,
    limit,
  });
  printSummary(result);
}

main().catch((error) => {
  console.error("[discovery:chinese-indie] failed:", error);
  process.exit(1);
});

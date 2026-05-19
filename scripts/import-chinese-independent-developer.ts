/**
 * 同步 chinese-independent-developer 项目库到 Discovery JSON 队列。
 *
 * 示例：
 * DRY_RUN=1 pnpm run discovery:chinese-indie
 * LIMIT=10 pnpm run discovery:chinese-indie
 * AUTO_IMPORT=1 LIMIT=20 pnpm run discovery:chinese-indie
 */

import {
  runChineseIndependentDeveloperImport,
  type RunChineseIndependentDeveloperImportResult,
} from "@/lib/discovery/sources/run-chinese-independent-developer-import";
import type { ChineseIndieEdition } from "@/lib/discovery/sources/chinese-independent-developer";

function readEdition(): ChineseIndieEdition | "all" {
  const raw = (process.env.EDITION ?? "all").trim().toLowerCase();
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

function printSummary(result: RunChineseIndependentDeveloperImportResult): void {
  console.log("\n=== chinese-independent-developer 同步结果 ===");
  console.log(`dryRun: ${result.dryRun ? "yes" : "no"}`);
  console.log(`autoImport: ${result.autoImport ? "yes" : "no"}`);
  console.log(`fetched files: ${result.fetched}`);
  console.log(`parsed entries: ${result.parsed}`);
  console.log(
    `parsed by edition: main=${result.parsedByEdition.main}, programmer=${result.parsedByEdition.programmer}, game=${result.parsedByEdition.game}`,
  );
  console.log(
    `queue stats: queued=${result.queued}, duplicates=${result.duplicates.length}, skippedClosed=${result.skippedClosed}, skippedInvalid=${result.skippedInvalid}, failed=${result.failed}`,
  );
  if (result.autoImport) {
    console.log(
      `import stats: imported=${result.imported}, importSkipped=${result.importSkipped}, importFailed=${result.importFailed}`,
    );
    if (result.importedSlugs.length > 0) {
      console.log(`imported slugs: ${result.importedSlugs.join(", ")}`);
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

  console.log(
    `[discovery:chinese-indie] start dryRun=${dryRun} autoImport=${autoImport} edition=${edition} limit=${limit ?? "none"}`,
  );

  const result = await runChineseIndependentDeveloperImport({
    dryRun,
    autoImport: dryRun ? false : autoImport,
    edition,
    limit,
  });
  printSummary(result);
}

main().catch((error) => {
  console.error("[discovery:chinese-indie] failed:", error);
  process.exit(1);
});

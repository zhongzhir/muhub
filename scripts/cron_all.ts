/**
 * Unified operations cron entrypoint.
 *
 * Run with: pnpm cron:all
 */

import { spawnSync } from "node:child_process";

const STEPS = [
  "ai:update",
  "source:update",
  "summary:update",
  "tracker:official-info",
] as const;

function main(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[cron:all] Missing DATABASE_URL");
    process.exit(1);
  }

  const failed: Array<{ step: string; status: number | null; signal: NodeJS.Signals | null }> = [];
  const packageManagerPath = process.env.npm_execpath;

  for (const step of STEPS) {
    const startedAt = Date.now();
    console.log(`\n[cron:all] ===== start ${step} =====`);
    const result = packageManagerPath
      ? spawnSync(process.execPath, [packageManagerPath, "run", step], {
          stdio: "inherit",
          cwd: process.cwd(),
          env: process.env,
        })
      : spawnSync("pnpm", ["run", step], {
          stdio: "inherit",
          cwd: process.cwd(),
          env: process.env,
        });
    const durationMs = Date.now() - startedAt;

    if (result.error) {
      console.error(`[cron:all] ${step} failed to start: ${result.error.message}`);
      failed.push({ step, status: null, signal: null });
      continue;
    }

    if (result.status === 0) {
      console.log(`[cron:all] ===== done ${step} in ${durationMs}ms =====`);
    } else {
      console.error(
        `[cron:all] ===== failed ${step} status=${result.status ?? "null"} signal=${result.signal ?? "null"} duration=${durationMs}ms =====`,
      );
      failed.push({ step, status: result.status, signal: result.signal });
    }
  }

  if (failed.length > 0) {
    console.error(
      `[cron:all] completed with ${failed.length} failed step(s): ${failed
        .map((f) => f.step)
        .join(", ")}`,
    );
    process.exit(1);
  }

  console.log("\n[cron:all] all steps completed");
  process.exit(0);
}

main();

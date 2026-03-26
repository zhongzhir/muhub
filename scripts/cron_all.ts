/**
 * 统一运营定时入口：依次执行 AI 运营、信息源抓取、周总结生成。
 *
 * 运行：pnpm cron:all（需 DATABASE_URL；OPENAI_API_KEY 等按各子脚本要求可选）
 */

import { execFileSync } from "node:child_process";

const STEPS = ["ai:update", "source:update", "summary:update"] as const;

function main(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[cron:all] 未设置 DATABASE_URL");
    process.exit(1);
  }

  for (const step of STEPS) {
    console.log(`\n[cron:all] ========== pnpm run ${step} ==========\n`);
    execFileSync("pnpm", ["run", step], {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });
  }

  console.log("\n[cron:all] 全部步骤完成");
  process.exit(0);
}

main();

/**
 * 手动触发 AI 运营检查：对比仓库远端与最新快照，必要时写快照 / 动态 / 摘要卡。
 *
 * 运行：pnpm ai:update（需 DATABASE_URL；OPENAI_API_KEY 可选）
 */

import { checkProjectUpdates, refreshProjectAiCardSummaries } from "@/lib/ai/project-ai-cron";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[ai:update] 未设置 DATABASE_URL，请在 .env 中配置。");
    process.exit(1);
  }

  console.log("[ai:update] checkProjectUpdates …");
  const cron = await checkProjectUpdates({ limit: 20, spacingMs: 350 });
  console.log("[ai:update] 快照/动态统计：", cron);

  console.log("[ai:update] refreshProjectAiCardSummaries …");
  const cards = await refreshProjectAiCardSummaries({ limit: 30 });
  console.log("[ai:update] 摘要卡：", cards);

  if (cron.errors.length > 0) {
    console.warn("[ai:update] 部分项目请求失败（可能限流或无网络）：");
    for (const e of cron.errors) {
      console.warn("  -", e);
    }
  }

  process.exit(0);
}

void main();

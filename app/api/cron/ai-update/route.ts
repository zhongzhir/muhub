import { verifyCronAuth, cronResponse } from "@/lib/cron/cron-auth";
import { checkProjectUpdates, refreshProjectAiCardSummaries } from "@/lib/ai/project-ai-cron";

/**
 * Cron: AI 运营更新
 * 调度：每天 02:00 UTC（vercel.json）
 * 功能：对比仓库最新快照，必要时写快照 / Release 动态 / 摘要卡
 *
 * 手动触发：
 *   curl -X GET https://www.muhub.cn/api/cron/ai-update \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

// Vercel Pro：最长运行 300s；Hobby：60s。按实际项目量调整。
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();
  console.log("[cron/ai-update] 开始");

  try {
    const updates = await checkProjectUpdates({ limit: 20, spacingMs: 350 });
    console.log("[cron/ai-update] checkProjectUpdates:", updates);

    const cards = await refreshProjectAiCardSummaries({ limit: 30 });
    console.log("[cron/ai-update] refreshProjectAiCardSummaries:", cards);

    const durationMs = Date.now() - startedAt;
    console.log(`[cron/ai-update] 完成，耗时 ${durationMs}ms`);

    return cronResponse({
      job: "ai-update",
      durationMs,
      updates,
      cards,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/ai-update] 异常:", message);
    return cronResponse({ job: "ai-update", error: message }, 500);
  }
}

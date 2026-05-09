import { verifyCronAuth, cronResponse } from "@/lib/cron/cron-auth";
import { trackAllProjectsOfficialInfo } from "@/lib/project-tracker/track-official-info";

/**
 * Cron: 项目官方信息全网追踪
 * 建议调度：每周一次（vercel.json 中可设置 0 3 * * 1）
 * 功能：对已上架项目进行官方信息来源追踪，补全官网、公众号、微博、抖音等
 *
 * 手动触发：
 *   curl -X GET https://www.muhub.cn/api/cron/track-official-info \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();
  console.log("[cron/track-official-info] 开始");

  try {
    const result = await trackAllProjectsOfficialInfo({
      limit: 40,
      onlyMissingSource: true,
      spacingMs: 600,
    });

    const durationMs = Date.now() - startedAt;
    console.log(`[cron/track-official-info] 完成，耗时 ${durationMs}ms`, {
      examined: result.examined,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return cronResponse({
      job: "track-official-info",
      durationMs,
      examined: result.examined,
      updated: result.updated,
      skipped: result.skipped,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 10), // 只返回前10条错误
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/track-official-info] 异常:", message);
    return cronResponse({ job: "track-official-info", error: message }, 500);
  }
}

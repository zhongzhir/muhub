import { cronResponse, verifyCronAuth } from "@/lib/cron/cron-auth";
import { trackAllProjectsOfficialInfo } from "@/lib/project-tracker/track-official-info";

/**
 * Cron: 项目官方信息补全与公开信号跟踪雏形。
 *
 * Manual trigger:
 *   curl -X GET https://www.muhub.cn/api/cron/track-official-info \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();
  console.log("[cron/track-official-info] start");

  try {
    const result = await trackAllProjectsOfficialInfo({
      limit: 40,
      onlyMissingSource: true,
      spacingMs: 600,
    });

    const durationMs = Date.now() - startedAt;
    console.log("[cron/track-official-info] done", {
      durationMs,
      checked: result.examined,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return cronResponse({
      job: "track-official-info",
      label: "项目官方信息补全与公开信号跟踪雏形",
      durationMs,
      checked: result.examined,
      updated: result.updated,
      skipped: result.skipped,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 10),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/track-official-info] fatal", message);
    return cronResponse({ job: "track-official-info", error: message }, 500);
  }
}

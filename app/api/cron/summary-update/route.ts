import { verifyCronAuth, cronResponse } from "@/lib/cron/cron-auth";
import { generateProjectWeeklySummary } from "@/lib/ai/project-summary";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

/**
 * Cron: AI 周总结生成
 * 调度：每周一 06:00 UTC（vercel.json）
 * 功能：遍历活跃项目，生成近 7 天多源动态的 AI Weekly Summary
 * 依赖：DATABASE_URL + OPENAI_API_KEY（未配置时静默跳过）
 *
 * 手动触发：
 *   curl -X GET https://www.muhub.cn/api/cron/summary-update \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();
  console.log("[cron/summary-update] 开始");

  try {
    const projects = await prisma.project.findMany({
      where: { status: "PUBLISHED", ...PROJECT_ACTIVE_FILTER },
      select: { id: true, slug: true },
      orderBy: { updatedAt: "desc" },
    });

    console.log(`[cron/summary-update] 项目数 ${projects.length}`);

    let ok = 0;
    let skipped = 0;

    for (const p of projects) {
      const r = await generateProjectWeeklySummary(p.id);
      if (r.ok) {
        ok += 1;
        console.log(`[cron/summary-update] ${p.slug}: ok updates=${r.updateCount} id=${r.id}`);
      } else {
        skipped += 1;
        console.log(`[cron/summary-update] ${p.slug}: skip (${r.reason})`);
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(`[cron/summary-update] 完成：成功 ${ok}，跳过 ${skipped}，耗时 ${durationMs}ms`);

    return cronResponse({
      job: "summary-update",
      durationMs,
      projectCount: projects.length,
      ok,
      skipped,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/summary-update] 异常:", message);
    return cronResponse({ job: "summary-update", error: message }, 500);
  }
}

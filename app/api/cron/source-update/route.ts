import { verifyCronAuth, cronResponse } from "@/lib/cron/cron-auth";
import { fetchProjectSourceUpdates } from "@/lib/source-fetch/fetch-source";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

/**
 * Cron: 信息源抓取更新
 * 调度：每天 04:00 UTC（vercel.json）
 * 功能：遍历含 WEBSITE/BLOG/DOCS 的活跃项目，抓取并写入 ProjectUpdate
 *
 * 手动触发：
 *   curl -X GET https://www.muhub.cn/api/cron/source-update \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const startedAt = Date.now();
  console.log("[cron/source-update] 开始");

  try {
    const projects = await prisma.project.findMany({
      where: {
        status: "PUBLISHED",
        ...PROJECT_ACTIVE_FILTER,
        sources: {
          some: { kind: { in: ["WEBSITE", "BLOG", "DOCS"] } },
        },
      },
      select: { id: true, slug: true },
      orderBy: { updatedAt: "desc" },
    });

    console.log(`[cron/source-update] 待处理项目 ${projects.length} 个`);

    let totalCreated = 0;
    const errors: string[] = [];

    for (const p of projects) {
      const r = await fetchProjectSourceUpdates(p.id);
      totalCreated += r.created;
      console.log(
        `[cron/source-update] ${p.slug}: sources=${r.examined} created=${r.created} skipped=${r.skipped}`,
      );
      for (const err of r.errors) {
        errors.push(`${p.slug}: ${err}`);
        console.warn(`  ! ${err}`);
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(`[cron/source-update] 完成，新建动态 ${totalCreated} 条，耗时 ${durationMs}ms`);

    return cronResponse({
      job: "source-update",
      durationMs,
      projectCount: projects.length,
      totalCreated,
      errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/source-update] 异常:", message);
    return cronResponse({ job: "source-update", error: message }, 500);
  }
}

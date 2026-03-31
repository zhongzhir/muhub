/**
 * 遍历活跃项目，生成 AI Weekly Summary（近 7 天多源动态）。
 *
 * 运行：pnpm summary:update（需 DATABASE_URL、OPENAI_API_KEY）
 */

import { generateProjectWeeklySummary } from "@/lib/ai/project-summary";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[summary:update] 未设置 DATABASE_URL");
    process.exit(1);
  }

  const projects = await prisma.project.findMany({
    where: { status: "ACTIVE", ...PROJECT_ACTIVE_FILTER },
    select: { id: true, slug: true },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`[summary:update] 项目数 ${projects.length}\n`);

  let ok = 0;
  let skipped = 0;
  for (const p of projects) {
    const r = await generateProjectWeeklySummary(p.id);
    if (r.ok) {
      ok += 1;
      console.log(`[summary:update] ${p.slug}: ok updates=${r.updateCount} id=${r.id}`);
    } else {
      skipped += 1;
      console.log(`[summary:update] ${p.slug}: skip (${r.reason})`);
    }
  }

  console.log(`\n[summary:update] 完成：成功 ${ok}，跳过 ${skipped}`);
  process.exit(0);
}

void main();

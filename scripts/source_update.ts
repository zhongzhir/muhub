/**
 * 信息源驱动动态：遍历含 WEBSITE/BLOG/DOCS 的活跃项目，抓取并写入 ProjectUpdate。
 *
 * 运行：pnpm source:update（需 DATABASE_URL）
 */

import { fetchProjectSourceUpdates } from "@/lib/source-fetch/fetch-source";
import { prisma } from "@/lib/prisma";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[source:update] 未设置 DATABASE_URL");
    process.exit(1);
  }

  const projects = await prisma.project.findMany({
    where: {
      status: "ACTIVE",
      sources: {
        some: { kind: { in: ["WEBSITE", "BLOG", "DOCS"] } },
      },
    },
    select: { id: true, slug: true },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`[source:update] 待处理项目 ${projects.length} 个\n`);

  let totalCreated = 0;
  for (const p of projects) {
    const r = await fetchProjectSourceUpdates(p.id);
    totalCreated += r.created;
    console.log(
      `[source:update] ${p.slug}: sources=${r.examined} created=${r.created} skipped=${r.skipped}`,
    );
    for (const err of r.errors) {
      console.warn(`  ! ${err}`);
    }
  }

  console.log(`\n[source:update] 完成，新建动态 ${totalCreated} 条`);
  process.exit(0);
}

void main();

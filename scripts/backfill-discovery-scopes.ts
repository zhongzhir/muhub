/**
 * 回填 Project.discoveryScopes
 *
 * 运行：pnpm tsx scripts/backfill-discovery-scopes.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[backfill:scopes] DATABASE_URL 未配置");
    process.exit(1);
  }

  const projects = await prisma.project.findMany({
    select: { id: true, slug: true, primaryCategory: true, discoveryScopes: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const p of projects) {
    const current = Array.isArray(p.discoveryScopes) ? (p.discoveryScopes as string[]) : [];
    const next = new Set<string>(current.length > 0 ? current : ["general"]);

    if (!next.has("general")) {
      next.add("general");
    }

    if (p.primaryCategory === "publishing_media") {
      next.add("publishing_ai");
    }

    const nextArr = Array.from(next);
    if (JSON.stringify(current.sort()) === JSON.stringify([...nextArr].sort())) {
      skipped++;
      continue;
    }

    await prisma.project.update({
      where: { id: p.id },
      data: { discoveryScopes: nextArr },
    });
    updated++;
    console.log(`  [OK] ${p.slug} → ${nextArr.join(", ")}`);
  }

  console.log(`\n[backfill:scopes] 完成：更新 ${updated}，跳过 ${skipped}，共 ${projects.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

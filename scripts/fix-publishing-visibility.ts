/**
 * 修复脚本：将出版类项目的 visibilityStatus 从 DRAFT 更新为 PUBLISHED
 * 运行：pnpm fix:pub-visibility
 */

import { PrismaClient, ProjectVisibilityStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("未设置 DATABASE_URL"); process.exit(1);
  }
  const result = await prisma.project.updateMany({
    where: {
      primaryCategory: "publishing_media",
      visibilityStatus: ProjectVisibilityStatus.DRAFT,
    },
    data: {
      visibilityStatus: ProjectVisibilityStatus.PUBLISHED,
      isPublic: true,
    },
  });
  console.log(`已更新 ${result.count} 个出版项目的 visibilityStatus → PUBLISHED`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

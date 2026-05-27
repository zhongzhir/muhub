/**
 * Entity Discovery E1 验收脚本
 * pnpm tsx scripts/acceptance-entity-discovery-e1.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const hintCount = await prisma.entityHint.count();
  const pendingCount = await prisma.entityHint.count({ where: { status: "PENDING" } });
  const acceptedCount = await prisma.entityHint.count({ where: { status: "ACCEPTED" } });

  const samples = await prisma.entityHint.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      entityType: true,
      confidence: true,
      status: true,
      sourceTitle: true,
      reason: true,
    },
  });

  const typeGroups = await prisma.entityHint.groupBy({
    by: ["entityType"],
    _count: { id: true },
  });

  const checks = {
    entityHintTableReadable: hintCount >= 0,
    hasExtractedHints: hintCount > 0,
  };

  console.log(
    JSON.stringify(
      {
        checks,
        counts: { hintCount, pendingCount, acceptedCount },
        byEntityType: typeGroups,
        samples,
      },
      null,
      2,
    ),
  );

  const failed = Object.entries(checks).filter(([, ok]) => !ok);
  if (failed.length > 0) {
    console.error("Acceptance checks failed:", failed.map(([k]) => k));
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

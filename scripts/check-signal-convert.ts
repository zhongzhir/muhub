import { prisma } from "@/lib/prisma";

async function main() {
  const signals = await prisma.discoverySignal.findMany({
    where: { source: { key: { startsWith: "publishing-" } } },
    select: { title: true, status: true, metadataJson: true },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  console.log(
    JSON.stringify(
      signals.map((x) => ({
        title: x.title.slice(0, 55),
        status: x.status,
        confidence: (x.metadataJson as { confidence?: number })?.confidence,
      })),
      null,
      2,
    ),
  );
  const autoConverted = await prisma.discoveryCandidate.count({
    where: {
      metadataJson: { path: ["autoConvertedFromSignal"], equals: true },
    },
  });
  const highConf = await prisma.discoveryCandidate.count({
    where: {
      metadataJson: { path: ["highConfidenceCandidate"], equals: true },
    },
  });
  console.log({ autoConverted, highConf });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

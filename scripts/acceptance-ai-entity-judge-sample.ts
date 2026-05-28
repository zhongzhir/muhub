/**
 * E1.5 验收：AI Judge 样例（dry-run，不写库）
 * pnpm tsx scripts/acceptance-ai-entity-judge-sample.ts
 */
import { prisma } from "@/lib/prisma";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import { parseSourceAuthorityTier } from "@/lib/discovery/entity/types";
import { runAiEntityJudge } from "@/lib/discovery/entity/ai-entity-judge";

async function main(): Promise<void> {
  const source = await prisma.discoverySource.findUnique({
    where: { key: "publishing-website-scan-dpresearch" },
  });
  if (!source) {
    console.log("source not found");
    return;
  }

  const signals = await prisma.discoverySignal.findMany({
    where: { sourceId: source.id, signalType: "WEBSITE_SCAN" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const accepted: Array<{ title: string; entity: string; reason: string }> = [];
  const rejected: Array<{ title: string; entity: string; reason: string }> = [];

  for (const signal of signals) {
    const scopes = parseScopesFromConfigJson(source.configJson);
    const result = await runAiEntityJudge({
      title: signal.title,
      summary: signal.summary,
      url: signal.url,
      signalType: signal.signalType,
      sourceType: signal.sourceType,
      sourceName: signal.sourceName,
      discoveryScopes: scopes,
      sourceAuthorityTier: parseSourceAuthorityTier(source.configJson),
      metadataJson: signal.metadataJson,
    });

    if (result.failed) {
      console.log("JUDGE FAILED", signal.title.slice(0, 40), result.error);
      continue;
    }

    for (const e of result.entities) {
      accepted.push({
        title: signal.title.slice(0, 50),
        entity: e.name,
        reason: e.reason,
      });
    }
    for (const e of result.rejected.slice(0, 2)) {
      rejected.push({
        title: signal.title.slice(0, 50),
        entity: e.name,
        reason: e.reason || result.skippedReason || "rejected",
      });
    }
    if (result.entities.length === 0 && result.skippedReason) {
      rejected.push({
        title: signal.title.slice(0, 50),
        entity: "(none)",
        reason: result.skippedReason,
      });
    }
  }

  console.log(JSON.stringify({ accepted: accepted.slice(0, 5), rejected: rejected.slice(0, 5) }, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

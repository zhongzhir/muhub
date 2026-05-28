import type { DiscoverySourceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** 可被 pipeline / 手动运行执行的状态 */
export function isDiscoverySourceRunnable(status: DiscoverySourceStatus | string): boolean {
  return status === "ACTIVE" || status === "TESTING";
}

/** 列表默认隐藏：已停用 / 已归档 */
export function isDiscoverySourceHiddenByDefault(status: DiscoverySourceStatus | string): boolean {
  return status === "DISABLED" || status === "ARCHIVED";
}

export type DeactivateDiscoverySourceResult = {
  action: "archived" | "deleted";
  sourceId: string;
  sourceKey: string;
  hadHistory: boolean;
};

/**
 * 安全停用来源：有历史产出 → ARCHIVED；完全无产出 → 物理删除。
 * 不删除 Signal / Candidate / EntityHint / DiscoveryRun。
 */
export async function deactivateDiscoverySource(
  sourceId: string,
): Promise<DeactivateDiscoverySourceResult> {
  const source = await prisma.discoverySource.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new Error("来源不存在");
  }

  if (source.status === "ARCHIVED" || source.status === "DISABLED") {
    return {
      action: "archived",
      sourceId: source.id,
      sourceKey: source.key,
      hadHistory: true,
    };
  }

  const [runCount, signalCount, candidateCount, hintCount] = await Promise.all([
    prisma.discoveryRun.count({ where: { sourceId } }),
    prisma.discoverySignal.count({ where: { sourceId } }),
    prisma.discoveryCandidate.count({ where: { sourceId } }),
    prisma.entityHint.count({
      where: { sourceSignal: { sourceId } },
    }),
  ]);

  const hadHistory = runCount + signalCount + candidateCount + hintCount > 0;

  if (!hadHistory) {
    await prisma.discoverySource.delete({ where: { id: sourceId } });
    console.info(
      "[source:deactivate]",
      JSON.stringify({ action: "deleted", sourceKey: source.key, sourceId }),
    );
    return {
      action: "deleted",
      sourceId: source.id,
      sourceKey: source.key,
      hadHistory: false,
    };
  }

  await prisma.discoverySource.update({
    where: { id: sourceId },
    data: { status: "ARCHIVED" },
  });

  console.info(
    "[source:deactivate]",
    JSON.stringify({
      action: "archived",
      sourceKey: source.key,
      sourceId,
      runCount,
      signalCount,
      candidateCount,
      hintCount,
    }),
  );

  return {
    action: "archived",
    sourceId: source.id,
    sourceKey: source.key,
    hadHistory: true,
  };
}

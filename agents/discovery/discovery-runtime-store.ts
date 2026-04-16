import { prisma } from "@/lib/prisma";
import { DiscoverySourceType } from "@prisma/client";

export type DiscoveryRuntimeState = {
  githubV3KeywordCursor: number;
};
const GITHUB_V3_RUNTIME_SOURCE_KEY = "github-v3-runtime";

function normalizeCursor(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function coerceRuntimeState(raw: unknown): DiscoveryRuntimeState {
  if (!raw || typeof raw !== "object") {
    return { githubV3KeywordCursor: 0 };
  }
  const row = raw as Record<string, unknown>;
  return {
    githubV3KeywordCursor: normalizeCursor(row.githubV3KeywordCursor),
  };
}

async function ensureRuntimeSource() {
  return prisma.discoverySource.upsert({
    where: { key: GITHUB_V3_RUNTIME_SOURCE_KEY },
    update: {},
    create: {
      key: GITHUB_V3_RUNTIME_SOURCE_KEY,
      name: "GitHub V3 Runtime",
      type: DiscoverySourceType.GITHUB,
      subtype: "runtime",
      status: "ACTIVE",
      configJson: { githubV3KeywordCursor: 0 },
    },
    select: { id: true, configJson: true },
  });
}

export async function ensureDiscoveryRuntimeStoreFile(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }
  try {
    await ensureRuntimeSource();
  } catch (e) {
    console.warn("[discovery-runtime-store] failed to initialize db runtime source", e);
  }
}

export async function readDiscoveryRuntimeState(): Promise<DiscoveryRuntimeState> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { githubV3KeywordCursor: 0 };
  }
  try {
    const row = await ensureRuntimeSource();
    return coerceRuntimeState(row.configJson);
  } catch (e) {
    console.warn("[discovery-runtime-store] failed to read db runtime state", e);
    return { githubV3KeywordCursor: 0 };
  }
}

export async function updateGitHubV3KeywordCursor(nextCursor: number): Promise<DiscoveryRuntimeState> {
  const normalized = normalizeCursor(nextCursor);
  const nextState: DiscoveryRuntimeState = { githubV3KeywordCursor: normalized };
  if (!process.env.DATABASE_URL?.trim()) {
    return nextState;
  }
  try {
    await prisma.discoverySource.upsert({
      where: { key: GITHUB_V3_RUNTIME_SOURCE_KEY },
      update: {
        configJson: nextState,
        lastRunAt: new Date(),
      },
      create: {
        key: GITHUB_V3_RUNTIME_SOURCE_KEY,
        name: "GitHub V3 Runtime",
        type: DiscoverySourceType.GITHUB,
        subtype: "runtime",
        status: "ACTIVE",
        configJson: nextState,
        lastRunAt: new Date(),
      },
    });
  } catch (e) {
    console.warn("[discovery-runtime-store] failed to persist db cursor, fallback to stateless mode", e);
  }
  return nextState;
}

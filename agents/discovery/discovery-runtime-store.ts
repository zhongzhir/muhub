import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

export type DiscoveryRuntimeState = {
  githubV3KeywordCursor: number;
};

const REL_PATH = join("data", "discovery-runtime.json");

function runtimeFilePath(): string {
  return join(process.cwd(), REL_PATH);
}

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

export async function ensureDiscoveryRuntimeStoreFile(): Promise<void> {
  const path = runtimeFilePath();
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path, "utf8");
  } catch {
    await writeFile(path, `${JSON.stringify({ githubV3KeywordCursor: 0 }, null, 2)}\n`, "utf8");
  }
}

export async function readDiscoveryRuntimeState(): Promise<DiscoveryRuntimeState> {
  await ensureDiscoveryRuntimeStoreFile();
  const path = runtimeFilePath();
  try {
    const raw = await readFile(path, "utf8");
    return coerceRuntimeState(JSON.parse(raw));
  } catch {
    return { githubV3KeywordCursor: 0 };
  }
}

export async function updateGitHubV3KeywordCursor(nextCursor: number): Promise<DiscoveryRuntimeState> {
  await ensureDiscoveryRuntimeStoreFile();
  const path = runtimeFilePath();
  const normalized = normalizeCursor(nextCursor);
  const nextState: DiscoveryRuntimeState = { githubV3KeywordCursor: normalized };
  await writeFile(path, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  return nextState;
}

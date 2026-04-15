import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export type ContentOutputItem = {
  filename: string;
  content: string;
  updatedAt: string;
};

function getOpsEngineCandidates() {
  const cwd = process.cwd();
  return [path.resolve(cwd, "muhub-ops-engine"), path.resolve(cwd, "..", "muhub-ops-engine")];
}

async function resolveOpsEngineDir() {
  for (const dir of getOpsEngineCandidates()) {
    try {
      await access(dir);
      return dir;
    } catch {
      // ignore missing candidate
    }
  }
  return null;
}

async function readOutputsByChannel(channel: "wechat" | "x", limit: number) {
  try {
    const opsDir = await resolveOpsEngineDir();
    if (!opsDir) {
      return [] as ContentOutputItem[];
    }

    const targetDir = path.resolve(opsDir, "outputs", channel);
    const names = await readdir(targetDir);
    const markdownFiles = names.filter((name) => name.toLowerCase().endsWith(".md"));

    const rows = await Promise.all(
      markdownFiles.map(async (filename) => {
        const fullPath = path.resolve(targetDir, filename);
        const fileStat = await stat(fullPath);
        return { filename, fullPath, mtimeMs: fileStat.mtimeMs, updatedAt: fileStat.mtime.toISOString() };
      }),
    );

    rows.sort((a, b) => b.mtimeMs - a.mtimeMs);
    const selected = rows.slice(0, Math.max(0, limit));

    return await Promise.all(
      selected.map(async (item) => {
        const content = await readFile(item.fullPath, "utf8");
        return {
          filename: item.filename,
          content,
          updatedAt: item.updatedAt,
        } satisfies ContentOutputItem;
      }),
    );
  } catch {
    return [] as ContentOutputItem[];
  }
}

export async function readLatestWechatOutput() {
  const items = await readOutputsByChannel("wechat", 1);
  return items[0] ?? null;
}

export async function readLatestXOutputs(limit = 5) {
  return await readOutputsByChannel("x", limit);
}

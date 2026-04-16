"use server";

import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  readDiscoveryItemById,
  readDiscoveryItems,
  updateDiscoveryItemDuplicateResult,
  updateDiscoveryItemImportResult,
  updateDiscoveryStatus,
} from "@/agents/discovery/discovery-store";
import { runGitHubDiscoveryV3 } from "@/agents/discovery/github/github-discovery-v3";
import { runRssDiscovery } from "@/agents/discovery/rss/rss-discovery";
import { runGitHubProjectActivity } from "@/agents/activity/github-activity";
import { importJsonDiscoveryItem } from "@/lib/discovery/import-json-queue-item";

const REVALIDATE = "/admin/discovery/items";
const execFileAsync = promisify(execFile);

export type ImportDiscoveryItemResult = {
  ok: boolean;
  message?: string;
  slug?: string;
};

export type RunGithubDiscoveryV3Result =
  | {
      ok: true;
      summary: Awaited<ReturnType<typeof runGitHubDiscoveryV3>>;
    }
  | { ok: false; error: string };

export type RunRssDiscoveryResult =
  | {
      ok: true;
      summary: { before: number; after: number; delta: number };
    }
  | { ok: false; error: string };

export type RunProjectActivityResult =
  | {
      ok: true;
      processed: number;
      created: number;
    }
  | { ok: false; error: string };

export type RunContentPipelineResult =
  | {
      ok: true;
      message: string;
      output: string;
    }
  | {
      ok: false;
      error: string;
    };

export type BulkDiscoveryStatusResult =
  | { ok: true; updated: number }
  | { ok: false; error: string };

export type BulkImportResult =
  | { ok: true; success: number; failed: number; skipped: number }
  | { ok: false; error: string };

export async function markDiscoveryItemReviewedAction(id: string): Promise<void> {
  await updateDiscoveryStatus(id, "reviewed");
  revalidatePath(REVALIDATE);
}

export async function markDiscoveryItemRejectedAction(id: string): Promise<void> {
  await updateDiscoveryStatus(id, "rejected");
  revalidatePath(REVALIDATE);
}

export async function markDiscoveryItemNewAction(id: string): Promise<void> {
  await updateDiscoveryStatus(id, "new");
  revalidatePath(REVALIDATE);
}

export async function importDiscoveryItemAction(id: string): Promise<ImportDiscoveryItemResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "请先登录后再执行导入。" };
  }

  const item = await readDiscoveryItemById(id);
  if (!item) {
    return { ok: false, message: "条目不存在或已被删除。" };
  }

  try {
    const { slug, created, duplicated, projectId } = await importJsonDiscoveryItem(item);
    const updated = duplicated
      ? await updateDiscoveryItemDuplicateResult(id, projectId, slug)
      : await updateDiscoveryItemImportResult(id, slug);
    if (!updated) {
      return { ok: false, message: "项目已创建或已关联，但回写 JSON 队列失败，请检查 data/discovery-items.json。" };
    }
    revalidatePath(REVALIDATE);
    revalidatePath("/projects");
    revalidatePath(`/projects/${slug}`);
    return {
      ok: true,
      slug,
      message: created ? "已导入项目库并生成收录动态。" : "已关联既有项目并标记为重复线索。",
    };
  } catch (e) {
    console.error("[importDiscoveryItemAction]", e);
    const msg =
      e instanceof Error ? e.message : "导入失败，请稍后重试或查看服务器日志。";
    return { ok: false, message: msg };
  }
}

export async function runGithubDiscoveryV3Action(): Promise<RunGithubDiscoveryV3Result> {
  try {
    const summary = await runGitHubDiscoveryV3();
    revalidatePath(REVALIDATE);
    return { ok: true, summary };
  } catch (err) {
    console.error("[runGithubDiscoveryV3Action]", err);
    const raw = err instanceof Error ? err.message : String(err);
    const normalized = raw.toLowerCase();
    if (
      normalized.includes("read-only file system") ||
      normalized.includes("ero fs") ||
      normalized.includes("discovery-runtime.json")
    ) {
      return {
        ok: false,
        error: "执行失败，请联系管理员检查运行时存储配置。",
      };
    }
    return {
      ok: false,
      error: raw,
    };
  }
}

export async function runRssDiscoveryAction(): Promise<RunRssDiscoveryResult> {
  try {
    const before = (await readDiscoveryItems()).length;
    await runRssDiscovery();
    const after = (await readDiscoveryItems()).length;
    revalidatePath(REVALIDATE);
    return {
      ok: true,
      summary: { before, after, delta: Math.max(0, after - before) },
    };
  } catch (err) {
    console.error("[runRssDiscoveryAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runProjectActivityAction(): Promise<RunProjectActivityResult> {
  try {
    const summary = await runGitHubProjectActivity();
    revalidatePath(REVALIDATE);
    const created = summary.inserted.release + summary.inserted.update;
    return {
      ok: true,
      processed: summary.withGithubUrl,
      created,
    };
  } catch (err) {
    console.error("[runProjectActivityAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function getOpsEngineCandidates() {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, "muhub-ops-engine"),
    path.resolve(cwd, "..", "muhub-ops-engine"),
  ];
}

async function resolveOpsEngineDir() {
  const candidates = getOpsEngineCandidates();
  for (const dir of candidates) {
    try {
      await access(dir);
      return dir;
    } catch {
      // ignore and continue
    }
  }
  return null;
}

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export async function runContentPipelineAction(): Promise<RunContentPipelineResult> {
  try {
    const opsEngineDir = await resolveOpsEngineDir();
    if (!opsEngineDir) {
      return { ok: false, error: "muhub-ops-engine not found" };
    }

    const npmCommand = getNpmCommand();
    const { stdout, stderr } = await execFileAsync(npmCommand, ["run", "gen:all"], {
      cwd: opsEngineDir,
      timeout: 10 * 60 * 1000,
      maxBuffer: 1024 * 1024 * 8,
      windowsHide: true,
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();

    return {
      ok: true,
      message: "Content pipeline completed",
      output,
    };
  } catch (err) {
    console.error("[runContentPipelineAction]", err);
    if (err && typeof err === "object" && "stderr" in err) {
      const stderr = String((err as { stderr?: string }).stderr ?? "").trim();
      if (stderr) {
        return { ok: false, error: stderr };
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function bulkMarkReviewedAction(ids: string[]): Promise<BulkDiscoveryStatusResult> {
  try {
    const targetIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
    let updated = 0;
    for (const id of targetIds) {
      const ok = await updateDiscoveryStatus(id, "reviewed");
      if (ok) {
        updated += 1;
      }
    }
    revalidatePath(REVALIDATE);
    return { ok: true, updated };
  } catch (err) {
    console.error("[bulkMarkReviewedAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function bulkRejectAction(ids: string[]): Promise<BulkDiscoveryStatusResult> {
  try {
    const targetIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
    let updated = 0;
    for (const id of targetIds) {
      const ok = await updateDiscoveryStatus(id, "rejected");
      if (ok) {
        updated += 1;
      }
    }
    revalidatePath(REVALIDATE);
    return { ok: true, updated };
  } catch (err) {
    console.error("[bulkRejectAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function bulkImportAction(ids: string[]): Promise<BulkImportResult> {
  try {
    const targetIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (const id of targetIds) {
      try {
        const result = await importDiscoveryItemAction(id);
        if (!result.ok) {
          failed += 1;
          continue;
        }
        if (result.message?.includes("标记为重复线索")) {
          skipped += 1;
          continue;
        }
        success += 1;
      } catch (err) {
        failed += 1;
        console.error(`[bulkImportAction:item:${id}]`, err);
      }
    }

    revalidatePath(REVALIDATE);
    return { ok: true, success, failed, skipped };
  } catch (err) {
    console.error("[bulkImportAction]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

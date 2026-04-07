"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  readDiscoveryItemById,
  updateDiscoveryItemImportResult,
  updateDiscoveryStatus,
} from "@/agents/discovery/discovery-store";
import { importJsonDiscoveryItem } from "@/lib/discovery/import-json-queue-item";

const REVALIDATE = "/admin/discovery/items";

export type ImportDiscoveryItemResult = {
  ok: boolean;
  message?: string;
  slug?: string;
};

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
    const { slug, created } = await importJsonDiscoveryItem(item);
    const updated = await updateDiscoveryItemImportResult(id, slug);
    if (!updated) {
      return { ok: false, message: "项目已创建或已关联，但回写 JSON 队列失败，请检查 data/discovery-items.json。" };
    }
    revalidatePath(REVALIDATE);
    revalidatePath("/projects");
    revalidatePath(`/projects/${slug}`);
    return {
      ok: true,
      slug,
      message: created ? "已导入项目库。" : "已关联既有项目（未新建重复条目）。",
    };
  } catch (e) {
    console.error("[importDiscoveryItemAction]", e);
    const msg =
      e instanceof Error ? e.message : "导入失败，请稍后重试或查看服务器日志。";
    return { ok: false, message: msg };
  }
}

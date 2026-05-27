"use server";

import { revalidatePath } from "next/cache";
import type { DiscoverySourceStatus } from "@prisma/client";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  createDiscoverySourceRecord,
  updateDiscoverySourceRecord,
  type CreateDiscoverySourceInput,
} from "@/lib/discovery/source-network/source-crud";
import type { SourceKind, SourceOwner } from "@/lib/discovery/source-network/source-kinds";
import type { DiscoveryScope } from "@/lib/discovery/discovery-scopes";
import { runDiscoverySourceByKey } from "@/lib/discovery/run-discovery-source";

export type SourceAdminResult = { ok: true; id?: string; key?: string } | { ok: false; error: string };

export async function createDiscoverySourceAction(
  formData: FormData,
): Promise<SourceAdminResult> {
  try {
    await requireMuHubAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof AdminAuthError ? e.message : "无权限" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const sourceKind = String(formData.get("sourceKind") ?? "RSS").trim() as SourceKind;
  const status = String(formData.get("status") ?? "TESTING").trim() as DiscoverySourceStatus;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const sourceOwner = String(formData.get("sourceOwner") ?? "manual").trim() as SourceOwner;
  const topicsRaw = String(formData.get("topics") ?? "").trim();
  const topics = topicsRaw
    ? topicsRaw.split(/[,，\n]/).map((t) => t.trim()).filter(Boolean)
    : undefined;

  const splitField = (name: string) =>
    String(formData.get(name) ?? "")
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const maxDepthRaw = String(formData.get("maxDepth") ?? "").trim();
  const maxPagesRaw = String(formData.get("maxPages") ?? "").trim();

  if (!name || !url) {
    return { ok: false, error: "名称与 URL 必填" };
  }

  const input: CreateDiscoverySourceInput = {
    name,
    url,
    sourceKind,
    status,
    notes,
    sourceOwner,
    scopes: ["publishing_ai"],
    topics,
    ...(sourceKind === "WEBSITE_SCAN"
      ? {
          allowedDomains: splitField("allowedDomains"),
          includeKeywords: splitField("includeKeywords"),
          excludePatterns: splitField("excludePatterns"),
          maxDepth: maxDepthRaw ? Number(maxDepthRaw) : undefined,
          maxPages: maxPagesRaw ? Number(maxPagesRaw) : undefined,
        }
      : {}),
  };

  try {
    const row = await createDiscoverySourceRecord(input);
    revalidatePath("/admin/discovery/sources");
    revalidatePath(`/admin/discovery/sources/${row.id}`);
    return { ok: true, id: row.id, key: row.key };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function updateDiscoverySourceAction(
  id: string,
  formData: FormData,
): Promise<SourceAdminResult> {
  try {
    await requireMuHubAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof AdminAuthError ? e.message : "无权限" };
  }

  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as DiscoverySourceStatus;
  const notes = String(formData.get("notes") ?? "").trim();

  try {
    await updateDiscoverySourceRecord(id, {
      name: name || undefined,
      url: url || undefined,
      status: status || undefined,
      notes,
      scopes: ["publishing_ai"],
      sourceOwner: String(formData.get("sourceOwner") ?? "manual").trim() as SourceOwner,
    });
    revalidatePath("/admin/discovery/sources");
    revalidatePath(`/admin/discovery/sources/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runDiscoverySourceFromAdminAction(
  sourceKey: string,
): Promise<{ ok: boolean; error?: string; runId?: string }> {
  try {
    await requireMuHubAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof AdminAuthError ? e.message : "无权限" };
  }
  const result = await runDiscoverySourceByKey(sourceKey.trim());
  revalidatePath("/admin/discovery/sources");
  revalidatePath("/admin/discovery");
  revalidatePath("/admin/discovery/signals");
  return result.ok
    ? { ok: true, runId: result.runId }
    : { ok: false, error: result.error ?? "运行失败" };
}

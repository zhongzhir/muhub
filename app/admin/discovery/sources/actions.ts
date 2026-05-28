"use server";

import { revalidatePath } from "next/cache";
import type { DiscoverySourceStatus } from "@prisma/client";
import { AdminAuthError, requireMuHubAdmin } from "@/lib/admin-auth";
import {
  createDiscoverySourceRecord,
  copyDiscoverySourceAsWebsiteScan,
  updateDiscoverySourceRecord,
  type CreateDiscoverySourceInput,
} from "@/lib/discovery/source-network/source-crud";
import { parseSourceKind, type SourceKind, type SourceOwner } from "@/lib/discovery/source-network/source-kinds";
import { runDiscoverySourceByKey } from "@/lib/discovery/run-discovery-source";
import { prisma } from "@/lib/prisma";

export type SourceAdminResult = { ok: true; id?: string; key?: string } | { ok: false; error: string };

function splitFormList(formData: FormData, name: string): string[] {
  return String(formData.get(name) ?? "")
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseFormInt(formData: FormData, name: string): number | undefined {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) {
    return undefined;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

function websiteScanPatchFromForm(formData: FormData) {
  return {
    allowedDomains: splitFormList(formData, "allowedDomains"),
    maxDepth: parseFormInt(formData, "maxDepth"),
    maxPages: parseFormInt(formData, "maxPages"),
    includeKeywords: splitFormList(formData, "includeKeywords"),
    excludePatterns: splitFormList(formData, "excludePatterns"),
  };
}

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

  const maxDepth = parseFormInt(formData, "maxDepth");
  const maxPages = parseFormInt(formData, "maxPages");

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
          allowedDomains: splitFormList(formData, "allowedDomains"),
          includeKeywords: splitFormList(formData, "includeKeywords"),
          excludePatterns: splitFormList(formData, "excludePatterns"),
          maxDepth,
          maxPages,
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
    const existing = await prisma.discoverySource.findUnique({
      where: { id },
      select: { configJson: true },
    });
    if (!existing) {
      return { ok: false, error: "来源不存在" };
    }

    const sourceKind = parseSourceKind(existing.configJson);
    const websiteScan =
      sourceKind === "WEBSITE_SCAN" ? websiteScanPatchFromForm(formData) : undefined;

    await updateDiscoverySourceRecord(id, {
      name: name || undefined,
      url: url || undefined,
      status: status || undefined,
      notes,
      scopes: ["publishing_ai"],
      sourceOwner: String(formData.get("sourceOwner") ?? "manual").trim() as SourceOwner,
      ...(websiteScan ? { websiteScan } : {}),
    });
    revalidatePath("/admin/discovery/sources");
    revalidatePath(`/admin/discovery/sources/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function copyDiscoverySourceAsWebsiteScanAction(
  sourceId: string,
): Promise<SourceAdminResult> {
  try {
    await requireMuHubAdmin();
  } catch (e) {
    return { ok: false, error: e instanceof AdminAuthError ? e.message : "无权限" };
  }

  try {
    const row = await copyDiscoverySourceAsWebsiteScan(sourceId.trim());
    revalidatePath("/admin/discovery/sources");
    revalidatePath(`/admin/discovery/sources/${sourceId}`);
    revalidatePath(`/admin/discovery/sources/${row.id}`);
    return { ok: true, id: row.id, key: row.key };
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

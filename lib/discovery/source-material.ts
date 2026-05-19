import type { DiscoveryItem } from "@/agents/discovery/discovery-types";

export function isSourceMaterialDiscoveryItem(item: Pick<DiscoveryItem, "meta">): boolean {
  return (
    item.meta?.itemKind === "source_material" ||
    item.meta?.needsExtraction === true ||
    item.meta?.captureType === "mobile"
  );
}

export function sourceMaterialExtractionStatusLabel(
  meta: Record<string, unknown> | undefined,
): string {
  const status = typeof meta?.autoExtractionStatus === "string" ? meta.autoExtractionStatus : "";
  if (status === "done") {
    const total = typeof meta?.autoExtractionTotal === "number" ? meta.autoExtractionTotal : 0;
    const queued = meta?.autoExtractionQueued;
    if (queued && typeof queued === "object" && !Array.isArray(queued)) {
      const row = queued as Record<string, unknown>;
      const success = typeof row.success === "number" ? row.success : null;
      const duplicate = typeof row.duplicate === "number" ? row.duplicate : null;
      if (success !== null && duplicate !== null) {
        return `已提取 ${total} 个项目（新增 ${success}，重复 ${duplicate}）`;
      }
    }
    return total > 0 ? `已提取 ${total} 个项目` : "已提取，未识别到项目";
  }
  if (status === "failed") {
    return "提取失败";
  }
  if (status === "skipped") {
    const reason = typeof meta?.autoExtractionReason === "string" ? meta.autoExtractionReason : "";
    if (reason === "no_url") return "待自动提取（无链接）";
    return "已跳过自动提取";
  }
  if (meta?.needsExtraction === true) {
    return "待自动提取";
  }
  return "待自动提取";
}

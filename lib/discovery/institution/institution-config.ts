import type { InstitutionSourceConfig } from "@/lib/discovery/institution/institution-source";
import type { InstitutionManualSeedItem } from "@/lib/discovery/institution/types";
import { isInstitutionSourceMode } from "@/lib/discovery/institution/types";

function asSeedItems(raw: unknown): InstitutionManualSeedItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const out: InstitutionManualSeedItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }
    const o = row as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) {
      continue;
    }
    out.push({
      title,
      ...(typeof o.summary === "string" ? { summary: o.summary } : {}),
      ...(typeof o.website === "string" ? { website: o.website.trim() } : {}),
      ...(typeof o.externalUrl === "string" ? { externalUrl: o.externalUrl.trim() } : {}),
      ...(o.metadata && typeof o.metadata === "object" && !Array.isArray(o.metadata)
        ? { metadata: o.metadata as Record<string, unknown> }
        : {}),
    });
  }
  return out.length > 0 ? out : null;
}

/**
 * 从 DiscoverySource.configJson 规范化机构配置（缺省 mode → website_list，兼容 Task 10 旧数据）
 */
export function parseInstitutionSourceConfig(raw: unknown): InstitutionSourceConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const urlRaw = typeof o.url === "string" ? o.url.trim() : "";
  const modeRaw = typeof o.mode === "string" ? o.mode.trim() : "";
  const mode = isInstitutionSourceMode(modeRaw) ? modeRaw : "website_list";

  const type = typeof o.type === "string" ? o.type.trim() : undefined;
  const region = typeof o.region === "string" ? o.region.trim() : undefined;

  if (mode === "manual_seed") {
    const seedItems = asSeedItems(o.seedItems);
    if (!id || !name || !seedItems) {
      return null;
    }
    return {
      id,
      name,
      url: urlRaw || "https://local.invalid/manual-seed",
      mode: "manual_seed",
      ...(type ? { type } : {}),
      ...(region ? { region } : {}),
      seedItems,
    };
  }

  if (!id || !name || !urlRaw) {
    return null;
  }

  return {
    id,
    name,
    url: urlRaw,
    mode,
    ...(type ? { type } : {}),
    ...(region ? { region } : {}),
  };
}

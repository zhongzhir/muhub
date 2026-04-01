import type { PrismaClient } from "@prisma/client";
import type { DiscoverySource } from "@prisma/client";
import { discoveryDedupeHashFromNormalizedKey } from "@/lib/discovery/dedupe-hash";
import { resolveInstitutionAdapter } from "@/lib/discovery/institution/institution-adapter-registry";
import { parseInstitutionSourceConfig } from "@/lib/discovery/institution/institution-config";
import type { InstitutionParsedItem } from "@/lib/discovery/institution/types";
import { upsertInstitutionDiscoveryCandidate } from "@/lib/discovery/upsert-candidate";

function primaryUrlForItem(
  item: InstitutionParsedItem,
  sourceConfigId: string,
): string {
  const u = item.website?.trim() || item.externalUrl?.trim();
  if (u) {
    return u.split("#")[0]!.trim();
  }
  const h = discoveryDedupeHashFromNormalizedKey(`${sourceConfigId}:${item.title}`).slice(0, 24);
  return `https://muhub.internal/institution-placeholder/${sourceConfigId}/${h}`;
}

export async function runInstitutionDiscovery(args: {
  db: PrismaClient;
  source: DiscoverySource;
  runId: string;
  key: string;
  logs: string[];
}): Promise<{
  fetchedCount: number;
  parsedCount: number;
  newCandidateCount: number;
  updatedCandidateCount: number;
}> {
  const { db, source, runId, key, logs } = args;

  const cfg = parseInstitutionSourceConfig(source.configJson as unknown);
  if (!cfg) {
    throw new Error(
      "INSTITUTION source configJson invalid: need id, name, url (except manual_seed uses seedItems); optional mode defaults to website_list",
    );
  }

  const adapter = resolveInstitutionAdapter(cfg);
  logs.push(`[${key}] adapter=${adapter.key} mode=${cfg.mode}`);

  const fetchRes = await adapter.fetch(cfg);
  if (!fetchRes.ok) {
    throw new Error(fetchRes.error);
  }

  if (!fetchRes.skippedFetch && fetchRes.html) {
    logs.push(`[${key}] fetched bytes=${fetchRes.html.length} url=${fetchRes.fetchedUrl ?? cfg.url}`);
  } else if (fetchRes.skippedFetch) {
    logs.push(`[${key}] fetch skipped (manual_seed)`);
  }

  const items = adapter.parse(fetchRes, cfg);
  logs.push(`[${key}] parsed items=${items.length}`);

  const institutionName = source.institutionName?.trim() || cfg.name;
  const institutionType = source.institutionType?.trim() || cfg.type;
  const institutionRegion = source.institutionRegion?.trim() || cfg.region;

  const sourceListUrl = fetchRes.fetchedUrl ?? cfg.url;

  let parsedCount = 0;
  let newCandidateCount = 0;
  let updatedCandidateCount = 0;

  for (const it of items) {
    const website = primaryUrlForItem(it, cfg.id);
    const description = it.summary ?? null;
    const name = it.title?.trim() || website;
    if (!name) {
      continue;
    }

    const rawInstitutionFields: Record<string, unknown> = {
      configId: cfg.id,
      ...(it.metadata && Object.keys(it.metadata).length > 0 ? { item: it.metadata } : {}),
      ...(it.sourceTitle ? { sourceTitle: it.sourceTitle } : {}),
      ...(it.sourceUrl ? { sourceUrl: it.sourceUrl } : {}),
    };

    const up = await upsertInstitutionDiscoveryCandidate(db, {
      sourceId: source.id,
      sourceKey: source.key,
      runId,
      name,
      description,
      website,
      institutionMeta: {
        institutionName: institutionName || null,
        institutionType: institutionType || null,
        institutionRegion: institutionRegion || null,
      },
      listUrl: sourceListUrl,
      sourceMode: cfg.mode,
      adapterKey: adapter.key,
      rawInstitutionFields,
      externalUrl: it.externalUrl?.trim() || it.sourceUrl?.trim() || undefined,
      sourceTitle: it.sourceTitle,
      sourceUrl: it.sourceUrl,
    });
    parsedCount += 1;
    if (up.created) {
      newCandidateCount += 1;
    } else {
      updatedCandidateCount += 1;
    }
  }

  return {
    fetchedCount: fetchRes.skippedFetch ? 0 : 1,
    parsedCount,
    newCandidateCount,
    updatedCandidateCount,
  };
}

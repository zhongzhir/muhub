import type { PrismaClient } from "@prisma/client";
import type { DiscoverySource } from "@prisma/client";
import type { InstitutionSourceConfig } from "@/lib/discovery/institution/institution-source";
import {
  listUrlFromInstitutionConfig,
  parseInstitutionProjects,
} from "@/lib/discovery/institution/parse-institution-projects";
import { upsertInstitutionDiscoveryCandidate } from "@/lib/discovery/upsert-candidate";

const FETCH_TIMEOUT_MS = 25_000;

function asInstitutionConfig(raw: unknown): InstitutionSourceConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name : "";
  const url = typeof o.url === "string" ? o.url : "";
  if (!id.trim() || !name.trim() || !url.trim()) {
    return null;
  }
  return {
    id: id.trim(),
    name: name.trim(),
    url: url.trim(),
    ...(typeof o.type === "string" ? { type: o.type } : {}),
    ...(typeof o.region === "string" ? { region: o.region } : {}),
  };
}

async function fetchInstitutionListingHtml(listUrl: string): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(listUrl, {
      redirect: "follow",
      signal: ac.signal,
      headers: {
        "User-Agent": "MUHUB-Discovery-Institution/1.0 (+https://github.com/zhongzhir/muhub)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const html = await res.text();
    return { ok: true, html };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
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

  const cfg = asInstitutionConfig(source.configJson as unknown);
  const listUrl = listUrlFromInstitutionConfig(cfg);
  if (!listUrl || !cfg) {
    throw new Error("INSTITUTION source requires configJson with id, name, and url (list page)");
  }

  const htmlRes = await fetchInstitutionListingHtml(listUrl);
  if (!htmlRes.ok) {
    throw new Error(`Fetch listing failed: ${htmlRes.error}`);
  }
  logs.push(`[${key}] fetched listing bytes=${htmlRes.html.length}`);

  const items = parseInstitutionProjects(htmlRes.html, listUrl);
  logs.push(`[${key}] parsed project links=${items.length}`);

  const institutionName = source.institutionName?.trim() || cfg.name;
  const institutionType = source.institutionType?.trim() || cfg.type;
  const institutionRegion = source.institutionRegion?.trim() || cfg.region;

  let parsedCount = 0;
  let newCandidateCount = 0;
  let updatedCandidateCount = 0;

  for (const it of items) {
    const up = await upsertInstitutionDiscoveryCandidate(db, {
      sourceId: source.id,
      sourceKey: source.key,
      runId,
      name: it.name,
      description: it.description,
      website: it.url,
      institutionMeta: {
        institutionName: institutionName || null,
        institutionType: institutionType || null,
        institutionRegion: institutionRegion || null,
      },
      listUrl,
    });
    parsedCount += 1;
    if (up.created) {
      newCandidateCount += 1;
    } else {
      updatedCandidateCount += 1;
    }
  }

  return {
    fetchedCount: 1,
    parsedCount,
    newCandidateCount,
    updatedCandidateCount,
  };
}

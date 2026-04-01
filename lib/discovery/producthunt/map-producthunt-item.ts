import { discoveryDedupeHashFromNormalizedKey } from "@/lib/discovery/dedupe-hash";
import {
  firstGithubRepoUrlFromText,
  normalizeGithubRepoUrl,
  normalizeWebsiteHost,
} from "@/lib/discovery/normalize-url";
import { slugifyProjectName } from "@/lib/project-slug";
import type { JsonValue } from "@/lib/discovery/types";
import type { ProductHuntPostNode } from "@/lib/discovery/producthunt/types";

export type ProductHuntCandidatePayload = {
  externalType: "producthunt_product";
  externalId: string;
  externalUrl: string;
  normalizedKey: string;
  dedupeHash: string;
  title: string;
  slugCandidate: string | null;
  summary: string | null;
  descriptionRaw: string | null;
  website: string | null;
  websiteHost: string | null;
  repoUrl: string | null;
  tagsJson: string[];
  categoriesJson: JsonValue;
  rawPayloadJson: JsonValue;
  avatarUrl: string | null;
  votesCount: number;
  launchAt: Date | null;
  metadataJson: JsonValue;
};

function topicNames(node: ProductHuntPostNode): string[] {
  const edges = node.topics?.edges ?? [];
  const out: string[] = [];
  for (const e of edges) {
    const n = e?.node?.name?.trim();
    if (n) {
      out.push(n);
    }
  }
  return [...new Set(out)];
}

function makerNames(node: ProductHuntPostNode): string[] {
  const edges = node.makers?.edges ?? [];
  const out: string[] = [];
  for (const e of edges) {
    const n = e?.node?.name?.trim() || e?.node?.username?.trim();
    if (n) {
      out.push(n);
    }
  }
  return [...new Set(out)];
}

function parsePhDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) {
    return null;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeHttpUrl(u: string | null | undefined): string | null {
  if (!u?.trim()) {
    return null;
  }
  try {
    return new URL(u.trim()).href;
  } catch {
    return null;
  }
}

/**
 * 将 Product Hunt Post 节点映射为 Discovery 写入负载。
 * GitHub：优先 `website` 指向 github.com，其次从描述中正则提取。
 */
export function mapProductHuntItemToCandidatePayload(
  node: ProductHuntPostNode,
  sourceKey: string,
): ProductHuntCandidatePayload | null {
  const id = node.id?.trim();
  const name = node.name?.trim();
  const phUrl = safeHttpUrl(node.url);
  if (!id || !name || !phUrl) {
    return null;
  }

  const normalizedKey = `producthunt:${id}`;
  const dedupeHash = discoveryDedupeHashFromNormalizedKey(normalizedKey);

  const websiteRaw = safeHttpUrl(node.website);
  let repoUrl: string | null = null;
  if (websiteRaw?.includes("github.com")) {
    try {
      repoUrl = normalizeGithubRepoUrl(websiteRaw);
    } catch {
      repoUrl = firstGithubRepoUrlFromText(websiteRaw) ?? websiteRaw;
    }
  }
  if (!repoUrl) {
    const fromDesc = firstGithubRepoUrlFromText(node.description ?? "");
    if (fromDesc) {
      try {
        repoUrl = normalizeGithubRepoUrl(fromDesc);
      } catch {
        repoUrl = fromDesc;
      }
    }
  }

  const tagline = node.tagline?.trim() ?? null;
  const description = node.description?.trim() ? node.description.trim() : null;
  const summary =
    tagline ??
    (description && description.length > 360 ? `${description.slice(0, 357)}…` : description);

  const topics = topicNames(node);
  const makers = makerNames(node);
  const votes = typeof node.votesCount === "number" ? node.votesCount : 0;
  const launchAt = parsePhDate(node.createdAt);
  const thumb = node.thumbnail?.url?.trim() || null;

  const rawPayloadJson: JsonValue = {
    source: "producthunt",
    sourceKey,
    id: node.id,
    name: node.name,
    tagline: node.tagline,
    url: phUrl,
    website: websiteRaw,
    votesCount: votes,
    createdAt: node.createdAt,
    topics,
    makers,
    thumbnailUrl: thumb,
  };

  const metadataJson: JsonValue = {
    productHunt: {
      postId: id,
      url: phUrl,
      votesCount: votes,
      launchAt: launchAt?.toISOString() ?? null,
      makers,
      topicSlugContext: sourceKey,
    },
  };

  let websiteOut: string | null = null;
  if (websiteRaw?.includes("github.com")) {
    websiteOut = null;
  } else if (websiteRaw) {
    websiteOut = websiteRaw;
  }

  return {
    externalType: "producthunt_product",
    externalId: id,
    externalUrl: phUrl,
    normalizedKey,
    dedupeHash,
    title: name,
    slugCandidate: slugifyProjectName(name) || null,
    summary,
    descriptionRaw: description,
    website: websiteOut,
    websiteHost: normalizeWebsiteHost(websiteOut),
    repoUrl,
    tagsJson: topics.length ? topics : makers.length ? makers.slice(0, 8) : [],
    categoriesJson: topics.length ? { productHuntTopics: topics } : { productHuntTopics: [] },
    rawPayloadJson,
    avatarUrl: thumb,
    votesCount: votes,
    launchAt,
    metadataJson,
  };
}

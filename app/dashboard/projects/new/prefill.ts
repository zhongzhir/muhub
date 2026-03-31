import type { ProjectSourceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRecommendedProjectBySlug } from "@/lib/recommended-projects";

const SOURCE_KINDS_SET = new Set<ProjectSourceKind>([
  "GITHUB",
  "GITEE",
  "WEBSITE",
  "DOCS",
  "BLOG",
  "TWITTER",
  "WECHAT",
  "XIAOHONGSHU",
  "DOUYIN",
  "ZHIHU",
  "BILIBILI",
  "DISCORD",
  "OTHER",
]);

export type NewProjectPrefill = {
  name: string;
  tagline: string;
  slug: string;
  description: string;
  githubUrl: string;
  giteeUrl: string;
  websiteUrl: string;
  /** import → 写库 `sourceType=import`，否则 manual */
  creationSource: string;
  /** 发现导入等场景：额外来源行（写入 ProjectSource） */
  extraSources?: { kind: ProjectSourceKind; url: string }[];
};

export function pickSearchParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = sp[key];
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && v[0] !== undefined) {
    return v[0];
  }
  return "";
}

export function parseProjectSourceRowsJson(raw: string): { kind: ProjectSourceKind; url: string }[] {
  if (!raw.trim()) {
    return [];
  }
  try {
    const data = JSON.parse(raw) as unknown;
    return parseSuggestedSourcesFromJson(Array.isArray(data) ? data : []);
  } catch {
    return [];
  }
}

function parseSuggestedSourcesFromJson(raw: unknown): { kind: ProjectSourceKind; url: string }[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: { kind: ProjectSourceKind; url: string }[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const kind = (row as { kind?: unknown }).kind;
    const url = (row as { url?: unknown }).url;
    if (typeof kind !== "string" || typeof url !== "string") {
      continue;
    }
    if (!SOURCE_KINDS_SET.has(kind as ProjectSourceKind)) {
      continue;
    }
    try {
      const href = new URL(url.trim()).href;
      out.push({ kind: kind as ProjectSourceKind, url: href });
    } catch {
      /* skip */
    }
  }
  return out;
}

/** 合并 query 与「推荐项目认领」预填（`from=recommended&slug=`） */
export function resolveNewProjectPrefill(
  sp: Record<string, string | string[] | undefined>,
): NewProjectPrefill {
  const fromRecommended = pickSearchParam(sp, "from") === "recommended";
  const recSlug = pickSearchParam(sp, "slug").trim();

  if (fromRecommended && recSlug) {
    const rec = getRecommendedProjectBySlug(recSlug);
    if (rec) {
      return {
        name: rec.name,
        tagline: rec.tagline,
        slug: rec.slug,
        description: "",
        githubUrl: `https://github.com/${rec.github}`,
        giteeUrl: "",
        websiteUrl: "",
        creationSource: pickSearchParam(sp, "creationSource").trim() || "manual",
        extraSources: [],
      };
    }
  }

  const githubFromImport = pickSearchParam(sp, "import").trim();
  const githubUrlParam = pickSearchParam(sp, "githubUrl").trim();
  const creationSource = pickSearchParam(sp, "creationSource").trim();

  return {
    name: pickSearchParam(sp, "name"),
    tagline: pickSearchParam(sp, "tagline"),
    slug: pickSearchParam(sp, "slug"),
    description: pickSearchParam(sp, "description"),
    githubUrl: githubUrlParam || githubFromImport,
    giteeUrl: pickSearchParam(sp, "giteeUrl"),
    websiteUrl: pickSearchParam(sp, "websiteUrl"),
    creationSource: creationSource || "manual",
    extraSources: [],
  };
}

/**
 * 服务端解析 query，并在「发现候选导入」场景合并 rawPayload.suggestedSources。
 */
export async function resolveNewProjectPrefillAsync(
  sp: Record<string, string | string[] | undefined>,
): Promise<NewProjectPrefill> {
  const base = resolveNewProjectPrefill(sp);
  const candidateId = pickSearchParam(sp, "discoveryCandidateId").trim();
  if (!candidateId || !process.env.DATABASE_URL?.trim()) {
    return base;
  }
  try {
    const cand = await prisma.discoveredProjectCandidate.findUnique({
      where: { id: candidateId },
      select: { rawPayload: true },
    });
    const payload = cand?.rawPayload;
    if (!payload || typeof payload !== "object") {
      return base;
    }
    const suggested = parseSuggestedSourcesFromJson(
      (payload as { suggestedSources?: unknown }).suggestedSources,
    );
    if (suggested.length === 0) {
      return base;
    }
    return { ...base, extraSources: suggested };
  } catch {
    return base;
  }
}

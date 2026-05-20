import type { ProjectSourceKind } from "@prisma/client";
import { parseGitHubRepoUrl } from "@/lib/github";
import { prisma } from "@/lib/prisma";
import { resolveProjectGithubUrl } from "@/lib/project-evidence-context";
import {
  bestDescriptionFromWebsiteEvidence,
  bestTitleFromWebsiteEvidence,
  collectProjectWebsiteFetchUrls,
  fetchWebsiteEvidence,
  fetchWebsiteEvidenceBatch,
  type WebsiteEvidenceSnapshot,
} from "@/lib/project-url-evidence";

export type CoverageLevel = "full" | "partial" | "missing";

export type ProjectEvidenceSnapshot = {
  version: "v2";
  generatedAt: string;
  projectId: string;
  project: {
    name: string;
    slug: string;
    tagline: string | null;
    description: string | null;
    websiteUrl: string | null;
    githubUrl: string | null;
    tags: string[];
    primaryCategory: string | null;
  };
  sources: {
    totalCount: number;
    kinds: string[];
    primarySources: Array<{ kind: string; url: string; label: string | null }>;
    missingKinds: string[];
    items: Array<{
      id: string;
      kind: string;
      url: string;
      label: string | null;
      title: string | null;
      summary: string | null;
      contentExcerpt: string | null;
      isPrimary: boolean;
    }>;
  };
  github: {
    url: string | null;
    repo: string | null;
    description: string | null;
    language: string | null;
    stars: number | null;
    updatedAt: string | null;
    readmeSummary: string | null;
    releaseCount: number | null;
    status: CoverageLevel;
  };
  website: {
    url: string | null;
    reachable: boolean;
    title: string | null;
    description: string | null;
    headings: string[];
    extractedSummary: string | null;
    status: CoverageLevel;
    evidence: WebsiteEvidenceSnapshot | null;
  };
  curated: {
    source: string | null;
    edition: string | null;
    markdownExcerpt: string | null;
    status: CoverageLevel;
  };
  social: {
    accounts: Record<string, string | null>;
    status: CoverageLevel;
  };
  docs: {
    urls: string[];
    hasDocsSignal: boolean;
    status: CoverageLevel;
  };
  signals: {
    githubActive: boolean | null;
    hasReleases: boolean | null;
    websiteHasPricing: boolean;
    websiteHasContact: boolean;
    missingPublicInfo: string[];
  };
  coverage: {
    github: CoverageLevel;
    website: CoverageLevel;
    curated: CoverageLevel;
    docs: CoverageLevel;
    social: CoverageLevel;
  };
  confidence: {
    overall: "A" | "B" | "C";
    evidenceCompleteness: number;
  };
};

const EXPECTED_KINDS: ProjectSourceKind[] = [
  "GITHUB",
  "WEBSITE",
  "DOCS",
  "WECHAT_ARTICLE",
  "WECHAT",
  "TWITTER",
];

function limitText(text: string, max: number): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

async function fetchGithubEvidence(repoUrl: string | null): Promise<{
  repo: string | null;
  description: string | null;
  language: string | null;
  stars: number | null;
  updatedAt: string | null;
  readmeSummary: string | null;
  releaseCount: number | null;
  isActive: boolean | null;
  hasReleases: boolean | null;
}> {
  if (!repoUrl) {
    return {
      repo: null,
      description: null,
      language: null,
      stars: null,
      updatedAt: null,
      readmeSummary: null,
      releaseCount: null,
      isActive: null,
      hasReleases: null,
    };
  }
  const parsed = parseGitHubRepoUrl(repoUrl);
  if (!parsed) {
    return {
      repo: repoUrl,
      description: null,
      language: null,
      stars: null,
      updatedAt: null,
      readmeSummary: null,
      releaseCount: null,
      isActive: null,
      hasReleases: null,
    };
  }
  const repo = `${parsed.owner}/${parsed.repo}`;
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MUHUB-Evidence-Snapshot",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  try {
    const repoRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`,
      { headers, cache: "no-store" },
    );
    if (!repoRes.ok) {
      return {
        repo,
        description: null,
        language: null,
        stars: null,
        updatedAt: null,
        readmeSummary: null,
        releaseCount: null,
        isActive: null,
        hasReleases: null,
      };
    }
    const repoJson = (await repoRes.json()) as {
      description?: string | null;
      stargazers_count?: number;
      pushed_at?: string | null;
      language?: string | null;
    };
    let releaseCount: number | null = null;
    const releaseRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/releases?per_page=1`,
      { headers, cache: "no-store" },
    );
    if (releaseRes.ok) {
      const link = releaseRes.headers.get("link");
      if (link) {
        const matched = link.match(/&page=(\d+)>; rel="last"/);
        releaseCount = matched ? Number(matched[1]) : 1;
      } else {
        const list = (await releaseRes.json()) as unknown[];
        releaseCount = Array.isArray(list) ? list.length : null;
      }
    }
    let readmeSummary: string | null = null;
    const readmeRes = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/readme`,
      { headers, cache: "no-store" },
    );
    if (readmeRes.ok) {
      const readmeJson = (await readmeRes.json()) as { content?: string; encoding?: string };
      if (readmeJson.encoding === "base64" && typeof readmeJson.content === "string") {
        const decoded = Buffer.from(readmeJson.content, "base64").toString("utf-8");
        readmeSummary = limitText(decoded.replace(/\s+/g, " ").trim(), 500);
      }
    }
    const updatedAt = repoJson.pushed_at ?? null;
    const pushedDays = updatedAt
      ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / (24 * 3600 * 1000))
      : null;
    return {
      repo,
      description: repoJson.description ?? null,
      language: repoJson.language ?? null,
      stars: typeof repoJson.stargazers_count === "number" ? repoJson.stargazers_count : null,
      updatedAt,
      readmeSummary,
      releaseCount,
      isActive: pushedDays != null ? pushedDays <= 90 : null,
      hasReleases: typeof releaseCount === "number" ? releaseCount > 0 : null,
    };
  } catch {
    return {
      repo,
      description: null,
      language: null,
      stars: null,
      updatedAt: null,
      readmeSummary: null,
      releaseCount: null,
      isActive: null,
      hasReleases: null,
    };
  }
}

function coverageFromGithub(input: {
  url: string | null;
  description: string | null;
  readmeSummary: string | null;
  stars: number | null;
}): CoverageLevel {
  if (!input.url) {
    return "missing";
  }
  const hasReadme = Boolean(input.readmeSummary?.trim());
  const hasMeta = Boolean(input.description?.trim()) || input.stars != null;
  if (hasReadme && hasMeta) {
    return "full";
  }
  if (hasReadme || hasMeta) {
    return "partial";
  }
  return "partial";
}

function coverageFromWebsite(evidence: WebsiteEvidenceSnapshot | null, url: string | null): CoverageLevel {
  if (!url) {
    return "missing";
  }
  if (!evidence?.reachable) {
    return "missing";
  }
  const hasTitle = Boolean(evidence.title?.trim() || evidence.ogTitle?.trim());
  const hasBody = Boolean(evidence.textExcerpt?.trim() || evidence.description?.trim());
  if (hasTitle && hasBody) {
    return "full";
  }
  if (hasTitle || hasBody) {
    return "partial";
  }
  return "partial";
}

function computeConfidence(coverage: ProjectEvidenceSnapshot["coverage"]): {
  overall: "A" | "B" | "C";
  evidenceCompleteness: number;
} {
  const weights: Array<[CoverageLevel, number]> = [
    [coverage.github, 25],
    [coverage.website, 25],
    [coverage.curated, 15],
    [coverage.docs, 15],
    [coverage.social, 10],
  ];
  let score = 0;
  for (const [level, weight] of weights) {
    if (level === "full") {
      score += weight;
    } else if (level === "partial") {
      score += Math.round(weight * 0.55);
    }
  }
  const overall: "A" | "B" | "C" = score >= 75 ? "A" : score >= 45 ? "B" : "C";
  return { overall, evidenceCompleteness: score };
}

function missingKindsPresent(
  kinds: string[],
  hasGithubUrl: boolean,
  hasWebsiteUrl: boolean,
): string[] {
  const set = new Set(kinds);
  const missing: string[] = [];
  if (!hasGithubUrl && !set.has("GITHUB") && !set.has("GITEE")) {
    missing.push("GITHUB");
  }
  if (!hasWebsiteUrl && !set.has("WEBSITE")) {
    missing.push("WEBSITE");
  }
  for (const kind of EXPECTED_KINDS) {
    if (kind === "GITHUB" || kind === "WEBSITE") {
      continue;
    }
    if (!set.has(kind)) {
      missing.push(kind);
    }
  }
  return missing;
}

export function formatEvidenceSnapshotForPrompt(snapshot: ProjectEvidenceSnapshot): string {
  const missingCoverage = Object.entries(snapshot.coverage)
    .filter(([, level]) => level === "missing")
    .map(([key]) => key);
  const lines = [
    "Project Evidence Snapshot V2",
    `generatedAt: ${snapshot.generatedAt}`,
    "",
    "【信息覆盖状态】",
    `coverage: ${JSON.stringify(snapshot.coverage)}`,
    `confidence: ${snapshot.confidence.overall} (${snapshot.confidence.evidenceCompleteness}/100)`,
    missingCoverage.length
      ? `缺失来源类型: ${missingCoverage.join(", ")}`
      : "缺失来源类型: 无（仍可能内容不足）",
    "",
    "【来源概览】",
    `sources.totalCount=${snapshot.sources.totalCount}, kinds=[${snapshot.sources.kinds.join(", ")}]`,
    snapshot.sources.missingKinds.length
      ? `sources.missingKinds=[${snapshot.sources.missingKinds.join(", ")}]`
      : null,
    "",
    "【GitHub】",
    snapshot.github.url
      ? `repo=${snapshot.github.repo ?? snapshot.github.url}, stars=${snapshot.github.stars ?? "?"}, language=${snapshot.github.language ?? "?"}`
      : "GitHub: missing",
    snapshot.github.readmeSummary
      ? `readme: ${limitText(snapshot.github.readmeSummary, 400)}`
      : snapshot.github.url
        ? "readme: 无或无法读取"
        : null,
    "",
    "【官网】",
    snapshot.website.url
      ? `reachable=${snapshot.website.reachable}, title=${snapshot.website.title ?? "无"}`
      : "官网: missing",
    snapshot.website.reachable === false && snapshot.website.url
      ? "官网当前不可达，请勿编造官网内容。"
      : null,
    snapshot.website.extractedSummary
      ? `summary: ${limitText(snapshot.website.extractedSummary, 500)}`
      : null,
    snapshot.website.headings.length
      ? `headings: ${snapshot.website.headings.slice(0, 6).join(" | ")}`
      : null,
    "",
    "【Curated】",
    snapshot.curated.markdownExcerpt
      ? `edition=${snapshot.curated.edition ?? "?"}, excerpt=${limitText(snapshot.curated.markdownExcerpt, 600)}`
      : "curated: missing",
    "",
    "【公开信息限制】",
    snapshot.signals.missingPublicInfo.length
      ? snapshot.signals.missingPublicInfo.join("；")
      : "当前公开信息相对完整，但仍需基于 evidence 表述，不可脑补。",
    !snapshot.github.url && !snapshot.website.reachable
      ? "当前公开信息有限：缺少可用 GitHub 与官网 evidence，请明确说明信息不足，不要猜测。"
      : null,
  ];
  return lines.filter(Boolean).join("\n");
}

export async function buildProjectEvidenceSnapshot(
  projectId: string,
): Promise<ProjectEvidenceSnapshot | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      sources: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      socialAccounts: true,
      externalLinks: true,
    },
  });
  if (!row) {
    return null;
  }

  const resolvedGithubUrl = resolveProjectGithubUrl({
    githubUrl: row.githubUrl,
    sources: row.sources,
  });
  const websiteUrl = row.websiteUrl?.trim() || null;

  const websiteCandidateUrls = collectProjectWebsiteFetchUrls({
    websiteUrl,
    officialWebsite: null,
    sources: row.sources.map((source) => ({
      kind: source.kind,
      url: source.url,
      isPrimary: source.isPrimary,
    })),
  });
  const fetchedWebsiteBatch = websiteUrl
    ? await fetchWebsiteEvidenceBatch(websiteCandidateUrls, { limit: 2 })
    : [];
  const websiteEvidence =
    fetchedWebsiteBatch.find((item) => item.reachable) ??
    fetchedWebsiteBatch[0] ??
    (websiteUrl ? await fetchWebsiteEvidence(websiteUrl).catch(() => null) : null);

  const githubLive = await fetchGithubEvidence(resolvedGithubUrl);

  const curatedSource = row.sources.find(
    (source) => source.label?.includes("curated_repository") || source.title?.includes("独立开发者"),
  );
  const docsSources = row.sources.filter((source) => source.kind === "DOCS" || source.kind === "BLOG");

  const socialAccounts: Record<string, string | null> = {
    twitter: null,
    wechatOfficialAccount: null,
    discord: null,
    telegram: null,
    linkedin: null,
    youtube: null,
  };
  for (const account of row.socialAccounts) {
    const url = account.accountUrl?.trim() || null;
    if (account.platform === "X") socialAccounts.twitter ??= url;
    if (account.platform === "WECHAT_OFFICIAL") {
      socialAccounts.wechatOfficialAccount ??= account.accountName || url;
    }
    if (account.platform === "DISCORD") socialAccounts.discord ??= url;
    if (account.platform === "BILIBILI") socialAccounts.youtube ??= url;
  }
  for (const link of row.externalLinks) {
    const p = link.platform.toLowerCase();
    if (p.includes("twitter") || p === "x") socialAccounts.twitter ??= link.url;
    if (p.includes("telegram")) socialAccounts.telegram ??= link.url;
    if (p.includes("linkedin")) socialAccounts.linkedin ??= link.url;
    if (p.includes("youtube")) socialAccounts.youtube ??= link.url;
    if (p.includes("discord")) socialAccounts.discord ??= link.url;
  }

  const kinds = [...new Set(row.sources.map((source) => source.kind))];
  const primarySources = row.sources
    .filter((source) => source.isPrimary)
    .map((source) => ({
      kind: source.kind,
      url: source.url,
      label: source.label,
    }));
  const missingKinds = missingKindsPresent(kinds, Boolean(resolvedGithubUrl), Boolean(websiteUrl));

  const websiteText = `${websiteEvidence?.title ?? ""} ${websiteEvidence?.description ?? ""} ${websiteEvidence?.textExcerpt ?? ""}`.toLowerCase();
  const hasDocsSignal =
    docsSources.length > 0 ||
    websiteText.includes("docs") ||
    websiteText.includes("文档");
  const hasSocial = Object.values(socialAccounts).some(Boolean) ||
    kinds.some((kind) => ["TWITTER", "WECHAT", "DISCORD", "BILIBILI", "DOUYIN"].includes(kind));

  const githubCoverage = coverageFromGithub({
    url: resolvedGithubUrl,
    description: githubLive.description,
    readmeSummary: githubLive.readmeSummary,
    stars: githubLive.stars,
  });
  const websiteCoverage = coverageFromWebsite(websiteEvidence, websiteUrl);
  const curatedCoverage: CoverageLevel = curatedSource?.content?.trim()
    ? "full"
    : curatedSource
      ? "partial"
      : "missing";
  const docsCoverage: CoverageLevel = docsSources.length
    ? "full"
    : hasDocsSignal
      ? "partial"
      : "missing";
  const socialCoverage: CoverageLevel = hasSocial ? (Object.values(socialAccounts).filter(Boolean).length >= 2 ? "full" : "partial") : "missing";

  const coverage = {
    github: githubCoverage,
    website: websiteCoverage,
    curated: curatedCoverage,
    docs: docsCoverage,
    social: socialCoverage,
  };

  const missingPublicInfo: string[] = [];
  if (!resolvedGithubUrl) {
    missingPublicInfo.push("缺少 GitHub 公开仓库信息");
  }
  if (!websiteUrl) {
    missingPublicInfo.push("缺少官网 URL");
  } else if (!websiteEvidence?.reachable) {
    missingPublicInfo.push("官网当前不可达或静态信息极少");
  }
  if (!curatedSource?.content?.trim()) {
    missingPublicInfo.push("缺少 curated 列表正文");
  }
  if (missingKinds.includes("WECHAT_ARTICLE")) {
    missingPublicInfo.push("缺少公众号/长文来源");
  }

  const editionMatch = curatedSource?.label?.match(/curated_repository · (\w+)/);
  const snapshot: ProjectEvidenceSnapshot = {
    version: "v2",
    generatedAt: new Date().toISOString(),
    projectId: row.id,
    project: {
      name: row.name,
      slug: row.slug,
      tagline: row.tagline,
      description: row.description,
      websiteUrl,
      githubUrl: resolvedGithubUrl,
      tags: row.tags,
      primaryCategory: row.primaryCategory,
    },
    sources: {
      totalCount: row.sources.length,
      kinds,
      primarySources,
      missingKinds,
      items: row.sources.map((source) => ({
        id: source.id,
        kind: source.kind,
        url: source.url,
        label: source.label,
        title: source.title,
        summary: source.summary ? limitText(source.summary, 400) : null,
        contentExcerpt: source.content ? limitText(source.content, 800) : null,
        isPrimary: source.isPrimary,
      })),
    },
    github: {
      url: resolvedGithubUrl,
      repo: githubLive.repo,
      description: githubLive.description,
      language: githubLive.language,
      stars: githubLive.stars,
      updatedAt: githubLive.updatedAt,
      readmeSummary: githubLive.readmeSummary,
      releaseCount: githubLive.releaseCount,
      status: githubCoverage,
    },
    website: {
      url: websiteUrl,
      reachable: websiteEvidence?.reachable ?? false,
      title: bestTitleFromWebsiteEvidence(websiteEvidence),
      description: bestDescriptionFromWebsiteEvidence(websiteEvidence),
      headings: websiteEvidence?.headings ?? [],
      extractedSummary: websiteEvidence?.textExcerpt
        ? limitText(websiteEvidence.textExcerpt, 800)
        : null,
      status: websiteCoverage,
      evidence: websiteEvidence,
    },
    curated: {
      source: curatedSource?.url ?? null,
      edition: editionMatch?.[1] ?? null,
      markdownExcerpt: curatedSource?.content
        ? limitText(curatedSource.content, 1200)
        : curatedSource?.summary
          ? limitText(curatedSource.summary, 400)
          : null,
      status: curatedCoverage,
    },
    social: {
      accounts: socialAccounts,
      status: socialCoverage,
    },
    docs: {
      urls: docsSources.map((source) => source.url),
      hasDocsSignal,
      status: docsCoverage,
    },
    signals: {
      githubActive: githubLive.isActive,
      hasReleases: githubLive.hasReleases,
      websiteHasPricing: websiteText.includes("pricing") || websiteText.includes("价格"),
      websiteHasContact: websiteText.includes("contact") || websiteText.includes("联系"),
      missingPublicInfo,
    },
    coverage,
    confidence: computeConfidence(coverage),
  };

  return snapshot;
}

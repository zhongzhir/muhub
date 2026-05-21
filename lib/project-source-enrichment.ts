import type { ProjectSourceKind } from "@prisma/client";

import { isAiConfigured } from "@/lib/ai/ai-config";
import { generateText } from "@/lib/ai/generate-text";
import { normalizeGithubRepoUrlOrNull } from "@/lib/discovery/normalize-url";
import { prisma } from "@/lib/prisma";
import {
  extractProjectSourceUrlsFromText,
  parseProjectSourceUrl,
} from "@/lib/project-source-url";
import { inferRepoSourceKind, normalizeSourceUrl } from "@/lib/project-sources";
import {
  fetchWebsiteEvidence,
  isFetchableProjectWebsiteUrl,
} from "@/lib/project-url-evidence";

export type EnrichmentSourceOrigin = "curated" | "website" | "ai";

export type EnrichmentCandidate = {
  url: string;
  kind: ProjectSourceKind;
  label: string;
  origin: EnrichmentSourceOrigin;
  confidence: "high" | "medium" | "low";
};

export type ProjectSourceEnrichmentResult = {
  addedSources: Array<{ kind: ProjectSourceKind; url: string; label: string; origin: EnrichmentSourceOrigin }>;
  skippedSources: Array<{ url: string; reason: string }>;
  confidence: "high" | "medium" | "low";
  notes: string[];
  githubUrlUpdated: boolean;
};

const DOCS_HOST_SUFFIXES = [
  "readthedocs.io",
  "gitbook.io",
  "gitbook.com",
  "docusaurus.io",
  "notion.site",
  "notion.so",
  "feishu.cn",
  "yuque.com",
];

const SOCIAL_HOSTS = new Set([
  "twitter.com",
  "x.com",
  "linkedin.com",
  "discord.com",
  "discord.gg",
  "t.me",
  "telegram.me",
  "youtube.com",
  "youtu.be",
  "bilibili.com",
  "zhihu.com",
  "xiaohongshu.com",
  "douyin.com",
]);

const PRODUCT_HOSTS = new Set([
  "producthunt.com",
  "apps.apple.com",
  "play.google.com",
  "chromewebstore.google.com",
  "chrome.google.com",
  "apps.microsoft.com",
  "microsoft.com",
]);

const NEWS_HOSTS = new Set([
  "36kr.com",
  "huxiu.com",
  "sspai.com",
  "juejin.cn",
  "tmtpost.com",
  "ifanr.com",
]);

function plainHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function registrableDomain(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) {
    return host;
  }
  return parts.slice(-2).join(".");
}

function isSameRegistrableDomain(a: string, b: string): boolean {
  return registrableDomain(a) === registrableDomain(b);
}

function stripTrailingPunctuation(raw: string): string {
  return raw
    .trim()
    .replace(/[),.;:!?\u{ff0c}\u{3002}\u{ff1b}\u{ff1a}\u{ff01}\u{ff1f}\u{3001}\u{ff09}\u{3011}\u{300b}]+$/u, "");
}

function decodeHtmlEntitiesInUrl(url: string): string {
  return url.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

function extractMarkdownLinkUrls(text: string): string[] {
  const re = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const url = match[1]?.trim();
    if (url) {
      out.push(decodeHtmlEntitiesInUrl(url));
    }
  }
  return out;
}

export function extractHttpUrlsFromText(text: string): string[] {
  const rawMatches = [
    ...(text.match(
      /(?:https?:\/\/|www\.)[^\s<>"'`\u{ff0c}\u{3002}\u{ff1b}\u{ff1a}\u{ff01}\u{ff1f}\u{3001}\u{ff08}\u{ff09}\u{3010}\u{3011}\u{300a}\u{300b}]+/giu,
    ) ?? []),
    ...extractMarkdownLinkUrls(text),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of rawMatches) {
    let raw = stripTrailingPunctuation(match);
    raw = decodeHtmlEntitiesInUrl(raw);
    if (/^www\./i.test(raw)) {
      raw = `https://${raw}`;
    }
    try {
      const u = new URL(raw);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        continue;
      }
      u.hash = "";
      const normalized = u.toString();
      const key = normalized.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(normalized);
    } catch {
      // skip invalid
    }
  }
  return out;
}

function extractUrlsFromHtml(html: string, baseUrl: string): string[] {
  const hrefs = html.match(/href=["']([^"'#]+)["']/gi) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const hrefMatch of hrefs) {
    const inner = hrefMatch.match(/href=["']([^"']+)["']/i)?.[1]?.trim();
    if (!inner || inner.startsWith("javascript:") || inner.startsWith("mailto:")) {
      continue;
    }
    try {
      const resolved = decodeHtmlEntitiesInUrl(new URL(inner, baseUrl).toString());
      const key = resolved.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(resolved);
    } catch {
      // skip
    }
  }
  return out;
}

export function classifyEnrichmentUrl(
  rawUrl: string,
  projectWebsiteHost: string | null,
): EnrichmentCandidate | null {
  const url = rawUrl.trim();
  if (!url.startsWith("http")) {
    return null;
  }
  const host = plainHost(url);
  if (!host) {
    return null;
  }

  const github = normalizeGithubRepoUrlOrNull(url);
  if (github) {
    return {
      url: github,
      kind: inferRepoSourceKind(github),
      label: "enriched_github",
      origin: "website",
      confidence: "high",
    };
  }

  const parsed = parseProjectSourceUrl(url);
  if (parsed?.type === "PRODUCTHUNT") {
    return {
      url: parsed.url,
      kind: "OTHER",
      label: "enriched_producthunt",
      origin: "website",
      confidence: "high",
    };
  }

  if (host === "gitee.com") {
    return {
      url,
      kind: "GITEE",
      label: "enriched_github",
      origin: "website",
      confidence: "high",
    };
  }

  if (SOCIAL_HOSTS.has(host) || SOCIAL_HOSTS.has(registrableDomain(host))) {
    const kind: ProjectSourceKind =
      host.includes("bilibili") ? "BILIBILI"
      : host.includes("zhihu") ? "ZHIHU"
      : host.includes("xiaohongshu") ? "XIAOHONGSHU"
      : host.includes("douyin") ? "DOUYIN"
      : "TWITTER";
    return {
      url,
      kind,
      label: "enriched_social",
      origin: "website",
      confidence: "high",
    };
  }

  if (PRODUCT_HOSTS.has(host) || PRODUCT_HOSTS.has(registrableDomain(host))) {
    let label = "enriched_product";
    if (host.includes("apple.com")) label = "enriched_app_store";
    if (host.includes("google.com") && url.includes("play")) label = "enriched_play_store";
    if (host.includes("chromewebstore") || url.includes("chrome.google.com/webstore")) {
      label = "enriched_chrome_store";
    }
    if (host.includes("microsoft.com")) label = "enriched_microsoft_store";
    if (host.includes("producthunt")) label = "enriched_producthunt";
    return {
      url,
      kind: "OTHER",
      label,
      origin: "website",
      confidence: "high",
    };
  }

  if (NEWS_HOSTS.has(host) || NEWS_HOSTS.has(registrableDomain(host))) {
    return {
      url,
      kind: "OTHER",
      label: "enriched_news",
      origin: "website",
      confidence: "medium",
    };
  }

  const isDocsHost =
    host.startsWith("docs.") ||
    DOCS_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`)) ||
    /\/docs(?:\/|$)/i.test(new URL(url).pathname);
  if (isDocsHost) {
    const trusted =
      !projectWebsiteHost ||
      isSameRegistrableDomain(host, projectWebsiteHost) ||
      DOCS_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
    if (trusted) {
      return {
        url,
        kind: "DOCS",
        label: "enriched_docs",
        origin: "website",
        confidence: projectWebsiteHost && isSameRegistrableDomain(host, projectWebsiteHost) ? "high" : "medium",
      };
    }
  }

  if (projectWebsiteHost && isSameRegistrableDomain(host, projectWebsiteHost)) {
    const path = new URL(url).pathname.toLowerCase();
    if (path.includes("/blog") || path.includes("/news")) {
      return {
        url,
        kind: "BLOG",
        label: "enriched_blog",
        origin: "website",
        confidence: "medium",
      };
    }
  }

  return null;
}

async function isUrlReachable(url: string, timeoutMs = 8000): Promise<boolean> {
  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MUHUB-SourceEnrichment/1.0; +https://muhub.app)",
      },
    });
    if (head.ok || (head.status >= 300 && head.status < 400)) {
      return true;
    }
  } catch {
    // fall through to GET
  }
  try {
    const get = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; MUHUB-SourceEnrichment/1.0; +https://muhub.app)",
      },
    });
    return get.ok || (get.status >= 300 && get.status < 400);
  } catch {
    return false;
  }
}

function candidateKey(candidate: EnrichmentCandidate): string {
  return `${candidate.kind}:${normalizeSourceUrl(candidate.url).toLowerCase()}`;
}

function extractFromCuratedContent(
  content: string,
  origin: EnrichmentSourceOrigin,
  websiteHost: string | null,
): EnrichmentCandidate[] {
  const out: EnrichmentCandidate[] = [];
  const seen = new Set<string>();

  const push = (candidate: EnrichmentCandidate | null) => {
    if (!candidate) return;
    const key = candidateKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...candidate, origin });
  };

  for (const item of extractProjectSourceUrlsFromText(content)) {
    push({
      url: item.source.url,
      kind: item.source.type === "GITCC" ? "OTHER" : inferRepoSourceKind(item.source.url),
      label: item.source.type === "PRODUCTHUNT" ? "enriched_producthunt" : "enriched_github",
      origin,
      confidence: "high",
    });
  }

  for (const raw of extractHttpUrlsFromText(content)) {
    push(classifyEnrichmentUrl(raw, websiteHost));
  }

  return out;
}

async function fetchWebsiteHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  if (!isFetchableProjectWebsiteUrl(url)) {
    return null;
  }
  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!resp.ok) {
      return null;
    }
    const contentType = resp.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }
    const html = await resp.text();
    return { html, finalUrl: resp.url || url };
  } catch {
    return null;
  }
}

type AiSourceInference = {
  githubUrl: string | null;
  docsUrl: string | null;
  socialUrls: string[];
  productUrls: string[];
  newsKeywords: string[];
};

async function inferSourcesWithAi(input: {
  name: string;
  websiteUrl: string | null;
  websiteHost: string | null;
  description: string | null;
  curatedExcerpt: string | null;
  websiteExcerpt: string | null;
}): Promise<EnrichmentCandidate[]> {
  if (!isAiConfigured()) {
    return [];
  }

  const prompt = [
    "你是 MUHUB 项目来源补全助手。根据已知公开信息，推断可能存在的官方来源 URL。",
    "你只能输出候选 URL，不得当作已验证事实。不确定时必须返回 null 或空数组。",
    "禁止编造域名或路径。",
    `项目名称：${input.name}`,
    input.websiteUrl ? `官网：${input.websiteUrl}` : "官网：无",
    input.websiteHost ? `官网域名：${input.websiteHost}` : null,
    input.description ? `项目描述：${input.description.slice(0, 600)}` : null,
    input.curatedExcerpt ? `Curated 摘录：${input.curatedExcerpt.slice(0, 800)}` : null,
    input.websiteExcerpt ? `官网正文摘要：${input.websiteExcerpt.slice(0, 800)}` : null,
    "请输出 JSON（不要 markdown）：",
    JSON.stringify({
      githubUrl: "string|null",
      docsUrl: "string|null",
      socialUrls: ["string"],
      productUrls: ["string"],
      newsKeywords: ["string"],
    }),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generateText(prompt, {
      maxTokens: 600,
      temperature: 0.2,
      systemPrompt:
        "You infer candidate public source URLs for software projects. Output valid JSON only. Never invent URLs.",
    });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }
    const parsed = JSON.parse(jsonMatch[0]) as AiSourceInference;
    const out: EnrichmentCandidate[] = [];
    const pushUrl = (url: unknown, fallbackLabel: string, kindHint?: ProjectSourceKind) => {
      if (typeof url !== "string" || !url.trim()) return;
      const classified =
        classifyEnrichmentUrl(url.trim(), input.websiteHost) ??
        (kindHint
          ? {
              url: url.trim(),
              kind: kindHint,
              label: fallbackLabel,
              origin: "ai" as const,
              confidence: "low" as const,
            }
          : null);
      if (classified) {
        out.push({ ...classified, origin: "ai", confidence: "low" });
      }
    };
    pushUrl(parsed.githubUrl, "enriched_github", "GITHUB");
    pushUrl(parsed.docsUrl, "enriched_docs", "DOCS");
    for (const url of parsed.socialUrls ?? []) {
      pushUrl(url, "enriched_social");
    }
    for (const url of parsed.productUrls ?? []) {
      pushUrl(url, "enriched_product");
    }
    return out;
  } catch (error) {
    console.warn("[project-source-enrichment] AI inference failed", error);
    return [];
  }
}

async function ensureEnrichedSource(
  projectId: string,
  candidate: EnrichmentCandidate,
  existingUrlKeys: Set<string>,
): Promise<boolean> {
  const normalized = normalizeSourceUrl(candidate.url);
  const key = `${candidate.kind}:${normalized.toLowerCase()}`;
  if (existingUrlKeys.has(key)) {
    return false;
  }

  const exists = await prisma.projectSource.findFirst({
    where: {
      projectId,
      OR: [{ url: normalized }, { url: candidate.url }],
    },
    select: { id: true, isPrimary: true },
  });
  if (exists) {
    existingUrlKeys.add(key);
    return false;
  }

  await prisma.projectSource.create({
    data: {
      projectId,
      kind: candidate.kind,
      url: normalized,
      label: candidate.label,
      isPrimary: false,
    },
  });
  existingUrlKeys.add(key);
  return true;
}

/**
 * 在 AI enrichment 前补全公开来源（curated → 官网 HTML → AI 候选 + 可达性校验）。
 */
export async function enrichProjectSources(projectId: string): Promise<ProjectSourceEnrichmentResult> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: { sources: { orderBy: { createdAt: "asc" } } },
  });
  if (!row) {
    throw new Error("项目不存在或已删除");
  }

  const notes: string[] = [];
  const skippedSources: ProjectSourceEnrichmentResult["skippedSources"] = [];
  const addedSources: ProjectSourceEnrichmentResult["addedSources"] = [];
  const existingUrlKeys = new Set(
    row.sources.map((source) => `${source.kind}:${normalizeSourceUrl(source.url).toLowerCase()}`),
  );

  const websiteUrl = row.websiteUrl?.trim() || null;
  const websiteHost = websiteUrl ? plainHost(websiteUrl) : null;
  const curatedSource = row.sources.find(
    (source) =>
      source.label?.includes("curated_repository") ||
      source.title?.includes("独立开发者"),
  );
  const curatedContent = curatedSource?.content?.trim() ?? "";

  const candidates: EnrichmentCandidate[] = [];

  if (curatedContent) {
    const fromCurated = extractFromCuratedContent(curatedContent, "curated", websiteHost);
    candidates.push(...fromCurated);
    notes.push(`curated 提取 ${fromCurated.length} 个候选`);
  }

  if (websiteUrl && isFetchableProjectWebsiteUrl(websiteUrl)) {
    const fetched = await fetchWebsiteHtml(websiteUrl);
    if (fetched) {
      const pageUrls = extractUrlsFromHtml(fetched.html, fetched.finalUrl);
      let websiteHits = 0;
      for (const pageUrl of pageUrls) {
        const classified = classifyEnrichmentUrl(pageUrl, websiteHost);
        if (classified) {
          candidates.push({ ...classified, origin: "website" });
          websiteHits += 1;
        }
      }
      notes.push(`官网 HTML 提取 ${websiteHits} 个候选`);
    } else {
      const evidence = await fetchWebsiteEvidence(websiteUrl).catch(() => null);
      if (evidence?.textExcerpt) {
        for (const pageUrl of extractHttpUrlsFromText(evidence.textExcerpt)) {
          const classified = classifyEnrichmentUrl(pageUrl, websiteHost);
          if (classified) {
            candidates.push({ ...classified, origin: "website" });
          }
        }
      }
      notes.push("官网 HTML 抓取失败，已尝试 evidence 摘要回退");
    }
  }

  const websiteExcerpt =
    row.sources.find((s) => s.kind === "WEBSITE" && s.isPrimary)?.content?.slice(0, 800) ??
    row.description?.slice(0, 400) ??
    null;

  const aiCandidates = await inferSourcesWithAi({
    name: row.name,
    websiteUrl,
    websiteHost,
    description: row.description,
    curatedExcerpt: curatedContent.slice(0, 800) || null,
    websiteExcerpt,
  });
  candidates.push(...aiCandidates);
  if (aiCandidates.length) {
    notes.push(`AI 推断 ${aiCandidates.length} 个候选（待校验）`);
  }

  const deduped = new Map<string, EnrichmentCandidate>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const existing = deduped.get(key);
    if (!existing || (existing.confidence === "low" && candidate.confidence !== "low")) {
      deduped.set(key, candidate);
    }
  }

  let trustedGithub: string | null = row.githubUrl?.trim() || null;

  for (const candidate of deduped.values()) {
    if (existingUrlKeys.has(candidateKey(candidate))) {
      skippedSources.push({ url: candidate.url, reason: "duplicate" });
      continue;
    }

    if (candidate.origin === "ai" || candidate.confidence === "low") {
      const reachable = await isUrlReachable(candidate.url);
      if (!reachable) {
        skippedSources.push({ url: candidate.url, reason: "unreachable" });
        continue;
      }
    }

    if (candidate.kind === "GITHUB" || candidate.kind === "GITEE") {
      const normalized = normalizeGithubRepoUrlOrNull(candidate.url);
      if (!normalized) {
        skippedSources.push({ url: candidate.url, reason: "invalid_github" });
        continue;
      }
      candidate.url = normalized;
    }

    const added = await ensureEnrichedSource(projectId, candidate, existingUrlKeys);
    if (added) {
      addedSources.push({
        kind: candidate.kind,
        url: candidate.url,
        label: candidate.label,
        origin: candidate.origin,
      });
      if ((candidate.kind === "GITHUB" || candidate.kind === "GITEE") && !trustedGithub) {
        trustedGithub = candidate.url;
      }
    } else {
      skippedSources.push({ url: candidate.url, reason: "already_exists" });
    }
  }

  let githubUrlUpdated = false;
  if (!row.githubUrl?.trim() && trustedGithub) {
    await prisma.project.update({
      where: { id: projectId },
      data: { githubUrl: trustedGithub },
    });
    githubUrlUpdated = true;
    notes.push(`已补写 Project.githubUrl=${trustedGithub}`);
  }

  const confidence: ProjectSourceEnrichmentResult["confidence"] =
    addedSources.some((s) => s.origin === "curated" || s.label === "enriched_github")
      ? "high"
      : addedSources.length > 0
        ? "medium"
        : "low";

  console.info("[project-source-enrichment] done", {
    projectId,
    added: addedSources.length,
    skipped: skippedSources.length,
    confidence,
  });

  return { addedSources, skippedSources, confidence, notes, githubUrlUpdated };
}

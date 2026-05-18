import { normalizeGithubRepoUrl } from "@/lib/discovery/normalize-url";
import { extractProjectSourceUrlsFromText } from "@/lib/project-source-url";

export type ArticleExistingProjectHit = {
  id: string;
  slug: string;
  name: string;
  reason: "githubUrl" | "websiteUrl" | "slug" | "name";
};

export type ArticleExtractedProject = {
  sourceType: "GITHUB" | "GITCC" | "PRODUCTHUNT" | "GENERAL";
  sourceUrl: string;
  sourceLabel: "GitHub" | "GitCC" | "Product Hunt" | "通用项目";
  githubUrl: string | null;
  owner: string | null;
  repo: string | null;
  projectName: string;
  summary: string | null;
  stars: number;
  language: string | null;
  websiteUrl: string | null;
  status: "ready" | "duplicate" | "error";
  errorMessage?: string;
  duplicateProject?: { slug: string; name: string } | null;
};

export type GeneralArticleProject = {
  name: string;
  summary: string | null;
  websiteUrl: string | null;
  category: string | null;
  wechatAccount: string | null;
};

export type OfficialSourceCompletion = {
  kind: "APP_STORE" | "GOOGLE_PLAY";
  url: string;
  label: string;
  evidence: string;
  confidence: number;
};

export type ArticleProjectInfo = {
  title: string;
  summary: string | null;
  websiteUrl: string | null;
  category: string | null;
  wechatAccount: string | null;
  weiboUrl: string | null;
  douyinUrl: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
};

export type FetchGithubRepoForArticle = (
  owner: string,
  repo: string,
) => Promise<{
  name: string;
  description: string | null;
  homepage: string | null;
  stargazers_count: number;
  language: string | null;
}>;

export type FindExistingProjectForArticle = (input: {
  githubUrl?: string | null;
  source?: { kind: "GITHUB" | "OTHER"; url: string; label?: string | null } | null;
  websiteUrl?: string | null;
  title: string;
  repo: string;
}) => Promise<ArticleExistingProjectHit | null>;

export type ExtractProjectsFromArticleTextResult =
  | {
      ok: true;
      items: ArticleExtractedProject[];
      totalUrls: number;
      uniqueRepoUrls: number;
    }
  | { ok: false; error: string };

export type ExtractProjectsFromUrlTextResult =
  | {
      ok: true;
      items: ArticleExtractedProject[];
      totalUrls: number;
      uniqueRepoUrls: number;
      articleTitle: string | null;
      articleBody: string;
    }
  | { ok: false; error: string };

export async function fetchUrlText(url: string): Promise<string | null> {
  try {
    const isWechat = url.includes("mp.weixin.qq.com");
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
    };
    if (isWechat) {
      headers.Referer = "https://mp.weixin.qq.com/";
      headers.Origin = "https://mp.weixin.qq.com";
    }
    const resp = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{2,120})["']/i)?.[1]?.trim() ||
      html.match(/<title[^>]*>([^<]{2,120})<\/title>/i)?.[1]?.trim() ||
      "";
    const body = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{3,}/g, "\n")
      .trim()
      .slice(0, 7500);
    return ogTitle ? `${ogTitle}\n\n${body}` : body;
  } catch {
    return null;
  }
}

export async function aiExtractProjectInfo(
  text: string,
  referenceUrl?: string,
): Promise<ArticleProjectInfo | null> {
  try {
    const { generateText } = await import("@/lib/ai/generate-text");
    const urlHint = referenceUrl ? `\n参考来源 URL：${referenceUrl}` : "";
    const prompt = `你是一个项目信息提取助手。请从以下文本中提取项目信息，以 JSON 格式返回，不要有任何多余内容。${urlHint}

文本内容：${text.slice(0, 4000)}

请提取以下字段（如果找不到，填 null）：
- title：项目名称（字符串，必填）
- summary：一句话简介，50~150字（字符串或 null）
- websiteUrl：项目官网 URL，优先找官方网址（字符串或 null）
- category：项目分类，例如"AI工具"、"AI漫画"、"开发工具"、"产品/服务"等（字符串或 null）
- wechatAccount：微信公众号名称或ID（字符串或 null，注意：不是微信文章链接）
- weiboUrl：微博账号主页 URL（字符串或 null，格式如 https://weibo.com/...）
- douyinUrl：抖音账号主页 URL（字符串或 null，格式如 https://www.douyin.com/user/...）
- appStoreUrl：Apple App Store 应用链接（字符串或 null）
- playStoreUrl：Google Play 应用链接（字符串或 null）
只返回 JSON，格式如下：
{"title":"...","summary":"...","websiteUrl":"...","category":"...","wechatAccount":null,"weiboUrl":null,"douyinUrl":null,"appStoreUrl":null,"playStoreUrl":null}`;

    const raw = await generateText(prompt, {
      maxTokens: 600,
      temperature: 0.2,
      systemPrompt: "你是项目信息提取专家，只返回 JSON，不要其他内容。",
    });
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) return null;
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "",
      summary: typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : null,
      websiteUrl:
        typeof parsed.websiteUrl === "string" && parsed.websiteUrl.startsWith("http")
          ? parsed.websiteUrl.trim()
          : null,
      category: typeof parsed.category === "string" && parsed.category.trim() ? parsed.category.trim() : null,
      wechatAccount:
        typeof parsed.wechatAccount === "string" && parsed.wechatAccount.trim()
          ? parsed.wechatAccount.trim()
          : null,
      weiboUrl:
        typeof parsed.weiboUrl === "string" && parsed.weiboUrl.startsWith("http")
          ? parsed.weiboUrl.trim()
          : null,
      douyinUrl:
        typeof parsed.douyinUrl === "string" && parsed.douyinUrl.startsWith("http")
          ? parsed.douyinUrl.trim()
          : null,
      appStoreUrl:
        typeof parsed.appStoreUrl === "string" && parsed.appStoreUrl.startsWith("http")
          ? parsed.appStoreUrl.trim()
          : null,
      playStoreUrl:
        typeof parsed.playStoreUrl === "string" && parsed.playStoreUrl.startsWith("http")
          ? parsed.playStoreUrl.trim()
          : null,
    };
  } catch {
    return null;
  }
}

function normalizeProjectNameForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s._\-:：·]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function stripGenericAiToken(value: string): string {
  return value.replace(/ai|人工智能/gi, "");
}

function projectNamesCloseEnough(a: string, b: string): boolean {
  const left = normalizeProjectNameForMatch(a);
  const right = normalizeProjectNameForMatch(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftNoAi = stripGenericAiToken(left);
  const rightNoAi = stripGenericAiToken(right);
  return Boolean(
    leftNoAi &&
      rightNoAi &&
      (leftNoAi === rightNoAi || leftNoAi.includes(rightNoAi) || rightNoAi.includes(leftNoAi)),
  );
}

function appStoreCountryFromText(text: string): string {
  return /中国|国内|大陆|中文|国区|应用市场|App Store 中国/i.test(text) ? "cn" : "us";
}

function normalizeCompletionSearchTerm(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/^[“”「」『』《》【】'"\[\]()（）\s]+/u, "")
    .replace(/[“”「」『』《》【】'"\[\]()（）\s]+$/u, "")
    .trim();
}

function officialSourceSearchTerms(input: {
  title: string;
  summary: string | null;
  referenceText: string;
}): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | null | undefined) => {
    const term = normalizeCompletionSearchTerm(value ?? "");
    if (term.length < 2 || term.length > 80) return;
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    terms.push(term);
  };

  push(input.title);

  const text = `${input.summary ?? ""}\n${input.referenceText}`;
  const aliasPatterns = [
    /(?:国内版本名为|国内版本(?:名|名称)?为|中国版本(?:名|名称)?为|应用名为|产品名为)\s*[《「“]\s*([\s\S]{2,80}?)\s*[》」”]/g,
    /(?:国内版本名为|国内版本(?:名|名称)?为|中国版本(?:名|名称)?为|应用名为|产品名为)\s*([A-Za-z0-9\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff\s-]{1,60})/g,
  ];
  for (const pattern of aliasPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      push(match[1]);
    }
  }

  return terms.slice(0, 5);
}

async function searchAppleAppStoreOfficialSource(input: {
  term: string;
  summary: string | null;
  referenceText: string;
}): Promise<OfficialSourceCompletion | null> {
  const term = input.term.trim();
  if (!term) return null;
  try {
    const country = appStoreCountryFromText(`${input.summary ?? ""}\n${input.referenceText}`);
    const params = new URLSearchParams({
      term,
      entity: "software",
      limit: "5",
      country,
    });
    const resp = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      results?: Array<{
        trackName?: unknown;
        sellerName?: unknown;
        trackViewUrl?: unknown;
      }>;
    };
    for (const item of json.results ?? []) {
      const trackName = typeof item.trackName === "string" ? item.trackName.trim() : "";
      const trackUrl = typeof item.trackViewUrl === "string" ? item.trackViewUrl.trim() : "";
      if (!trackName || !trackUrl.startsWith("http")) continue;
      if (!projectNamesCloseEnough(term, trackName)) continue;
      const sellerName = typeof item.sellerName === "string" ? item.sellerName.trim() : "";
      return {
        kind: "APP_STORE",
        url: trackUrl,
        label: sellerName ? `App Store: ${trackName} (${sellerName})` : `App Store: ${trackName}`,
        evidence: `itunes-search term="${term}" country=${country} matched trackName="${trackName}"`,
        confidence: normalizeProjectNameForMatch(term) === normalizeProjectNameForMatch(trackName) ? 0.92 : 0.78,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function searchGooglePlayOfficialSource(input: {
  term: string;
  summary: string | null;
  referenceText: string;
}): Promise<OfficialSourceCompletion | null> {
  const term = input.term.trim();
  if (!term) return null;
  try {
    const gl = /中国|国内|大陆|中文|应用市场/i.test(`${input.summary ?? ""}\n${input.referenceText}`)
      ? "cn"
      : "us";
    const params = new URLSearchParams({
      q: term,
      c: "apps",
      hl: "en",
      gl,
    });
    const resp = await fetch(`https://play.google.com/store/search?${params.toString()}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.8,zh-CN;q=0.6",
      },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const seen = new Set<string>();
    const linkRegex = /href="(\/store\/apps\/details\?id=[^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html))) {
      const href = match[1].replace(/&amp;/g, "&");
      if (seen.has(href)) continue;
      seen.add(href);
      const index = Math.max(0, match.index - 800);
      const context = html
        .slice(index, Math.min(html.length, match.index + 800))
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim();
      if (!projectNamesCloseEnough(term, context)) continue;
      return {
        kind: "GOOGLE_PLAY",
        url: `https://play.google.com${href}`,
        label: `Google Play: ${term}`,
        evidence: `google-play-search term="${term}" gl=${gl} matched app details link`,
        confidence: 0.74,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export async function completeOfficialSourcesLightly(input: {
  title: string;
  summary: string | null;
  referenceText: string;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
}): Promise<OfficialSourceCompletion[]> {
  const shouldSearchStores = /应用市场|App Store|Google Play|play store|下载|install|download/i.test(
    `${input.title}\n${input.summary ?? ""}\n${input.referenceText}`,
  );
  const terms = officialSourceSearchTerms(input);
  if (!shouldSearchStores && terms.length <= 1) {
    return [];
  }

  const completions: OfficialSourceCompletion[] = [];
  if (!input.appStoreUrl) {
    for (const term of terms) {
      const appStore = await searchAppleAppStoreOfficialSource({ ...input, term });
      if (appStore) {
        completions.push(appStore);
        break;
      }
    }
  }
  if (!input.playStoreUrl) {
    for (const term of terms) {
      const playStore = await searchGooglePlayOfficialSource({ ...input, term });
      if (playStore) {
        completions.push(playStore);
        break;
      }
    }
  }
  return completions;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanArticleProjectName(value: string): string {
  return value
    .replace(/^[「『“'\s]+|[」』”'\s]+$/g, "")
    .replace(/[，。；;：:！!？?].*$/g, "")
    .trim();
}

function summaryAround(text: string, needle: string): string | null {
  const index = text.indexOf(needle);
  if (index < 0) return null;
  return (
    text
      .slice(index, index + 220)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180) || null
  );
}

export function heuristicExtractGeneralProjectsFromArticle(text: string): GeneralArticleProject[] {
  const patterns = [
    /([A-Z][A-Za-z0-9][A-Za-z0-9._-]{1,40})(?:的出现|可以看做是|给自己的定位|进入欧美|进入日本|进入[^，。]{1,20}市场)/g,
    /(?:产品|应用|工具|项目)\s*[「『“]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,40})\s*[」』”]/g,
  ];
  const out: GeneralArticleProject[] = [];
  const seen = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const name = cleanArticleProjectName(match[1]);
      if (!name || isHttpUrl(name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name,
        summary: summaryAround(text, name),
        websiteUrl: null,
        category: null,
        wechatAccount: null,
      });
    }
  }
  return out.slice(0, 8);
}

export function mergeGeneralArticleProjects(
  primary: GeneralArticleProject[],
  fallback: GeneralArticleProject[],
): GeneralArticleProject[] {
  const out: GeneralArticleProject[] = [];
  const seen = new Set<string>();
  for (const item of [...primary, ...fallback]) {
    const key = item.name.toLowerCase();
    if (!item.name || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function aiExtractGeneralProjectsFromArticle(text: string): Promise<GeneralArticleProject[]> {
  try {
    const { generateText } = await import("@/lib/ai/generate-text");
    const prompt = `你是一个项目/产品信息提取助手。请从以下文章正文中识别所有明确提及的产品、应用、工具或项目（不包括公司本身，只找产品/项目/工具/应用名称），以 JSON 数组格式返回，不要有任何多余内容。
文章正文：${text.slice(0, 5000)}

请找出所有在文章中作为产品、工具或项目提及的名称（排除纯粹的公司名/机构名，除非该名称也是其核心产品名）。
对每一个识别到的项目返回以下字段（找不到填 null）：
- name：项目/产品名称（必填）
- summary：在文章中的简短描述（null 或字符串）
- websiteUrl：如文章提供了官网链接（null 或字符串）
- category：产品类别如"AI漫画"、"AI视频"、"AI图像"等（null 或字符串）
- wechatAccount：微信公众号名（null 或字符串）
只返回 JSON 数组，格式如下：
[{"name":"项目A","summary":"...","websiteUrl":null,"category":"AI漫画","wechatAccount":null}]

如果找不到任何项目，返回空数组：[]`;

    const raw = await generateText(prompt, {
      maxTokens: 1500,
      temperature: 0.1,
      systemPrompt: "你是项目信息提取专家，只返回 JSON 数组，不要其他内容。",
    });
    const jsonStr = raw.match(/\[[\s\S]*\]/)?.[0];
    if (!jsonStr) return [];
    const parsed = JSON.parse(jsonStr) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "",
        summary: typeof item.summary === "string" && item.summary.trim() ? item.summary.trim() : null,
        websiteUrl:
          typeof item.websiteUrl === "string" && item.websiteUrl.startsWith("http")
            ? item.websiteUrl.trim()
            : null,
        category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : null,
        wechatAccount:
          typeof item.wechatAccount === "string" && item.wechatAccount.trim()
            ? item.wechatAccount.trim()
            : null,
      }))
      .filter((item) => item.name.length > 0);
  } catch {
    return [];
  }
}

export async function extractProjectsFromArticleText(input: {
  articleBody: string;
  findExistingProject: FindExistingProjectForArticle;
  fetchGithubRepo: FetchGithubRepoForArticle;
  logLabel?: string;
  allowEmptyResults?: boolean;
  githubGenericErrorMessage?: string;
  generalSourceUrlFromWebsite?: boolean;
}): Promise<ExtractProjectsFromArticleTextResult> {
  const body = input.articleBody.trim();
  const items: ArticleExtractedProject[] = [];
  const seenNames = new Set<string>();
  const extracted = extractProjectSourceUrlsFromText(body);

  if (input.logLabel) {
    console.log(
      `[${input.logLabel}] project source matches:`,
      extracted.map((item) => item.source.url),
    );
  }

  for (const { source } of extracted) {
    if (source.type === "GITCC") {
      const projectName =
        source.url.replace(/\/+$/g, "").split("/").filter(Boolean).pop() || "GitCC 项目";
      const duplicate = await input.findExistingProject({
        githubUrl: null,
        source: { kind: "OTHER", url: source.url, label: "GitCC" },
        websiteUrl: source.url,
        title: projectName,
        repo: projectName,
      });
      seenNames.add(projectName.toLowerCase());
      items.push({
        sourceType: "GITCC",
        sourceUrl: source.url,
        sourceLabel: "GitCC",
        githubUrl: null,
        owner: null,
        repo: null,
        projectName,
        summary: "已识别为 GitCC 来源，可加入发现队列或导入为外部项目。",
        stars: 0,
        language: null,
        websiteUrl: source.url,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
      continue;
    }
    if (source.type === "PRODUCTHUNT") {
      const slug = source.slug || source.url.replace(/\/+$/, "").split("/").filter(Boolean).pop() || "product";
      const projectName = slug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      const duplicate = await input.findExistingProject({
        githubUrl: null,
        source: { kind: "OTHER", url: source.url, label: "Product Hunt" },
        websiteUrl: source.url,
        title: projectName,
        repo: projectName,
      });
      seenNames.add(projectName.toLowerCase());
      items.push({
        sourceType: "PRODUCTHUNT",
        sourceUrl: source.url,
        sourceLabel: "Product Hunt",
        githubUrl: null,
        owner: null,
        repo: null,
        projectName,
        summary: null,
        stars: 0,
        language: null,
        websiteUrl: source.url,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
      continue;
    }
    if (source.type !== "GITHUB") {
      continue;
    }
    const githubUrl = normalizeGithubRepoUrl(source.url);
    try {
      const repoData = await input.fetchGithubRepo(source.owner, source.repo);
      const duplicate = await input.findExistingProject({
        githubUrl,
        source: { kind: "GITHUB", url: githubUrl, label: "GitHub" },
        websiteUrl: repoData.homepage || null,
        title: repoData.name,
        repo: source.repo,
      });
      seenNames.add(repoData.name.toLowerCase());
      items.push({
        sourceType: "GITHUB",
        sourceUrl: githubUrl,
        sourceLabel: "GitHub",
        githubUrl,
        owner: source.owner,
        repo: source.repo,
        projectName: repoData.name,
        summary: repoData.description,
        stars: repoData.stargazers_count,
        language: repoData.language,
        websiteUrl: repoData.homepage,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "解析失败";
      seenNames.add(source.repo.toLowerCase());
      items.push({
        sourceType: "GITHUB",
        sourceUrl: githubUrl,
        sourceLabel: "GitHub",
        githubUrl,
        owner: source.owner,
        repo: source.repo,
        projectName: source.repo,
        summary: null,
        stars: 0,
        language: null,
        websiteUrl: null,
        status: "error",
        errorMessage: message.includes("项目不存在")
          ? "项目不存在"
          : message.includes("GitHub API")
            ? "GitHub API 调用失败"
            : input.githubGenericErrorMessage ?? "解析失败",
        duplicateProject: null,
      });
    }
  }

  try {
    const aiProjects = mergeGeneralArticleProjects(
      await aiExtractGeneralProjectsFromArticle(body),
      heuristicExtractGeneralProjectsFromArticle(body),
    );
    for (const proj of aiProjects) {
      if (!proj.name || seenNames.has(proj.name.toLowerCase())) continue;
      seenNames.add(proj.name.toLowerCase());
      const duplicate = await input.findExistingProject({
        githubUrl: null,
        source: null,
        websiteUrl: proj.websiteUrl || null,
        title: proj.name,
        repo: proj.name,
      });
      items.push({
        sourceType: "GENERAL",
        sourceUrl:
          input.generalSourceUrlFromWebsite === false
            ? `general:${proj.name}`
            : proj.websiteUrl || `general:${proj.name}`,
        sourceLabel: "通用项目",
        githubUrl: null,
        owner: null,
        repo: null,
        projectName: proj.name,
        summary: proj.summary,
        stars: 0,
        language: null,
        websiteUrl: proj.websiteUrl,
        status: duplicate ? "duplicate" : "ready",
        duplicateProject: duplicate ? { slug: duplicate.slug, name: duplicate.name } : null,
      });
    }
  } catch (err) {
    console.warn("[extractProjectsFromArticleText] AI 通用项目提取失败:", err);
  }

  const totalItems = extracted.length;
  const hasResults = items.length > 0;
  if (!hasResults && totalItems === 0 && !input.allowEmptyResults) {
    return {
      ok: false,
      error: "正文中未识别到明确项目、产品、应用、服务或工具信息，请检查内容是否包含可收录对象。",
    };
  }

  return {
    ok: true,
    items,
    totalUrls: totalItems,
    uniqueRepoUrls: totalItems,
  };
}

export async function extractProjectsFromUrlText(input: {
  url: string;
  findExistingProject: FindExistingProjectForArticle;
  fetchGithubRepo: FetchGithubRepoForArticle;
}): Promise<ExtractProjectsFromUrlTextResult> {
  const pageText = await fetchUrlText(input.url);
  if (!pageText || pageText.length < 50) {
    return {
      ok: false,
      error: "无法抓取该 URL 的内容，请检查链接是否可访问，或改为粘贴文章正文。",
    };
  }

  const extracted = await extractProjectsFromArticleText({
    articleBody: pageText,
    findExistingProject: input.findExistingProject,
    fetchGithubRepo: input.fetchGithubRepo,
    allowEmptyResults: true,
    githubGenericErrorMessage: "GitHub API 调用失败",
    generalSourceUrlFromWebsite: false,
  });
  if (!extracted.ok) {
    return extracted;
  }

  const titleMatch = pageText.match(/(?:^|\n)([^\n]{5,80})(?:\n|$)/);
  const articleTitle = titleMatch ? titleMatch[1].trim() || null : null;

  return {
    ok: true,
    items: extracted.items,
    totalUrls: extracted.totalUrls,
    uniqueRepoUrls: extracted.uniqueRepoUrls,
    articleTitle,
    articleBody: pageText,
  };
}

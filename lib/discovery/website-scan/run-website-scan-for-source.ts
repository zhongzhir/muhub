import type { DiscoverySource } from "@prisma/client";
import { attachDiscoveryScopesToMetadata } from "@/lib/discovery/scope-from-config";
import { upsertDiscoverySignalFromSeed } from "@/lib/discovery/signals";
import {
  computeScanConfidence,
  extractHtmlLinks,
  extractHtmlSnippet,
  extractHtmlTitle,
  fetchScanPageHtml,
  matchKeywords,
} from "@/lib/discovery/website-scan/html-utils";
import {
  hostnameAllowed,
  normalizeScanUrl,
  urlExcluded,
  urlHasSkippedExtension,
} from "@/lib/discovery/website-scan/parse-config";
import {
  isWechatUrl,
  WEBSITE_SCAN_DEFAULTS,
  type WebsiteScanConfig,
  type WebsiteScanPageResult,
  type WebsiteScanRunResult,
} from "@/lib/discovery/website-scan/types";

type QueueItem = {
  url: string;
  depth: number;
  parentUrl: string | null;
  linkTitle?: string;
};

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistScanPageAsSignal(args: {
  source: Pick<DiscoverySource, "id" | "key" | "name" | "type">;
  config: WebsiteScanConfig;
  page: WebsiteScanPageResult;
}): Promise<{ created: boolean } | null> {
  const { source, config, page } = args;

  const metadataJson = attachDiscoveryScopesToMetadata(
    {
      sourceKey: source.key,
      pageUrl: page.pageUrl,
      title: page.title,
      snippet: page.snippet,
      matchedKeywords: page.matchedKeywords,
      depth: page.depth,
      parentUrl: page.parentUrl,
      confidence: page.confidence,
      reason: page.reason,
      scanMode: "website_scan",
      wechatLinkOnly: page.wechatLinkOnly ?? false,
    },
    config.scopes,
  );

  const result = await upsertDiscoverySignalFromSeed({
    sourceId: source.id,
    sourceType: source.type,
    sourceName: source.name,
    sourceKey: source.key,
    seed: {
      signalType: "WEBSITE_SCAN",
      title: page.title,
      summary: page.snippet,
      url: page.pageUrl,
      rawText: page.snippet,
    },
    metadataJson,
  });

  if (!result) {
    return null;
  }
  return { created: result.created };
}

function pageFromLinkItem(
  item: QueueItem,
  config: WebsiteScanConfig,
): WebsiteScanPageResult | null {
  const title = (item.linkTitle ?? "").trim();
  if (!title) {
    return null;
  }
  const matched = matchKeywords(`${title} ${item.url}`, config.includeKeywords);
  if (matched.length === 0) {
    return null;
  }
  return {
    pageUrl: item.url,
    title,
    snippet: title,
    matchedKeywords: matched,
    depth: item.depth,
    parentUrl: item.parentUrl,
    confidence: computeScanConfidence(matched, item.depth),
    reason: "微信外链：链接文本命中关键词，未抓正文",
    wechatLinkOnly: true,
  };
}

function pageFromHtml(args: {
  url: string;
  html: string;
  depth: number;
  parentUrl: string | null;
  config: WebsiteScanConfig;
}): WebsiteScanPageResult | null {
  const title = extractHtmlTitle(args.html);
  const snippet = extractHtmlSnippet(args.html);
  const haystack = `${title} ${snippet} ${args.url}`;
  const matched = matchKeywords(haystack, args.config.includeKeywords);
  if (matched.length === 0) {
    return null;
  }
  return {
    pageUrl: args.url,
    title: title || args.url,
    snippet,
    matchedKeywords: matched,
    depth: args.depth,
    parentUrl: args.parentUrl,
    confidence: computeScanConfidence(matched, args.depth),
    reason: `页面标题/摘要命中关键词：${matched.join("、")}`,
  };
}

export async function runWebsiteScanForSource(args: {
  source: DiscoverySource;
  config: WebsiteScanConfig;
  logs: string[];
}): Promise<WebsiteScanRunResult> {
  const { source, config, logs } = args;
  const key = source.key;

  const result: WebsiteScanRunResult = {
    fetchedPages: 0,
    matchedPages: 0,
    newSignals: 0,
    updatedSignals: 0,
    skippedPages: 0,
    errors: [],
  };

  if (config.includeKeywords.length === 0) {
    const msg = "includeKeywords 为空，跳过扫描";
    logs.push(`[${key}] website_scan error: ${msg}`);
    result.errors.push(msg);
    return result;
  }

  logs.push(
    `[${key}] website_scan start urls=${config.startUrls.length} maxDepth=${config.maxDepth} maxPages=${config.maxPages} keywords=${config.includeKeywords.length}`,
  );

  const visited = new Set<string>();
  const queue: QueueItem[] = config.startUrls
    .map((u) => normalizeScanUrl(u))
    .filter((u): u is string => Boolean(u))
    .map((url) => ({ url, depth: 0, parentUrl: null }));

  while (queue.length > 0 && result.fetchedPages < config.maxPages) {
    const item = queue.shift()!;
    if (visited.has(item.url)) {
      continue;
    }
    visited.add(item.url);

    let hostname: string;
    try {
      hostname = new URL(item.url).hostname.toLowerCase();
    } catch {
      result.skippedPages += 1;
      continue;
    }

    if (!hostnameAllowed(hostname, config.allowedDomains)) {
      result.skippedPages += 1;
      continue;
    }
    if (urlExcluded(item.url, config.excludePatterns)) {
      result.skippedPages += 1;
      continue;
    }
    if (urlHasSkippedExtension(item.url)) {
      result.skippedPages += 1;
      continue;
    }

    if (isWechatUrl(item.url) && item.linkTitle) {
      const page = pageFromLinkItem(item, config);
      if (page) {
        result.matchedPages += 1;
        const up = await persistScanPageAsSignal({ source, config, page });
        if (up?.created) {
          result.newSignals += 1;
        } else if (up) {
          result.updatedSignals += 1;
        }
      }
      continue;
    }

    if (isWechatUrl(item.url)) {
      result.skippedPages += 1;
      logs.push(`[${key}] skip weixin fetch without link title: ${item.url}`);
      continue;
    }

    result.fetchedPages += 1;
    await sleep(WEBSITE_SCAN_DEFAULTS.minDelayMs);

    const fetched = await fetchScanPageHtml(item.url);
    if (!fetched.ok) {
      const err = `${item.url}: ${fetched.error}`;
      result.errors.push(err);
      logs.push(`[${key}] fetch error ${err}`);
      continue;
    }

    const page = pageFromHtml({
      url: fetched.fetchedUrl,
      html: fetched.html,
      depth: item.depth,
      parentUrl: item.parentUrl,
      config,
    });

    if (page) {
      result.matchedPages += 1;
      const up = await persistScanPageAsSignal({ source, config, page });
      if (up?.created) {
        result.newSignals += 1;
      } else if (up) {
        result.updatedSignals += 1;
      }
    }

    if (item.depth >= config.maxDepth) {
      continue;
    }

    const links = extractHtmlLinks(fetched.html, fetched.fetchedUrl);
    for (const link of links) {
      if (visited.has(link.href)) {
        continue;
      }
      let linkHost: string;
      try {
        linkHost = new URL(link.href).hostname.toLowerCase();
      } catch {
        continue;
      }
      if (!hostnameAllowed(linkHost, config.allowedDomains)) {
        continue;
      }
      if (urlExcluded(link.href, config.excludePatterns) || urlHasSkippedExtension(link.href)) {
        continue;
      }

      if (isWechatUrl(link.href)) {
        const matched = matchKeywords(`${link.text} ${link.href}`, config.includeKeywords);
        if (matched.length > 0) {
          queue.push({
            url: link.href,
            depth: item.depth + 1,
            parentUrl: fetched.fetchedUrl,
            linkTitle: link.text || link.href,
          });
        }
        continue;
      }

      queue.push({
        url: link.href,
        depth: item.depth + 1,
        parentUrl: fetched.fetchedUrl,
      });
    }
  }

  logs.push(
    `[${key}] website_scan done fetched=${result.fetchedPages} matched=${result.matchedPages} newSignals=${result.newSignals} updated=${result.updatedSignals} errors=${result.errors.length}`,
  );

  return result;
}

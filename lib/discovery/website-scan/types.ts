import type { DiscoveryScope } from "@/lib/discovery/discovery-scopes";

/**
 * WEBSITE_SCAN — 受控站点扫描配置与结果类型
 */

export type WebsiteScanConfig = {
  mode: "website_scan";
  startUrls: string[];
  allowedDomains: string[];
  maxDepth: number;
  maxPages: number;
  includeKeywords: string[];
  excludePatterns: string[];
  scopes: DiscoveryScope[];
};

export type WebsiteScanPageResult = {
  pageUrl: string;
  title: string;
  snippet: string;
  matchedKeywords: string[];
  depth: number;
  parentUrl: string | null;
  confidence: number;
  reason: string;
  /** 微信外链：仅链接文本，未抓正文 */
  wechatLinkOnly?: boolean;
};

export type WebsiteScanRunResult = {
  fetchedPages: number;
  matchedPages: number;
  newSignals: number;
  updatedSignals: number;
  skippedPages: number;
  errors: string[];
};

export const WEBSITE_SCAN_DEFAULTS = {
  maxDepth: 2,
  maxPages: 50,
  fetchTimeoutMs: 20_000,
  minDelayMs: 300,
} as const;

export const SKIP_EXTENSIONS = [
  ".pdf",
  ".zip",
  ".rar",
  ".7z",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".mp3",
  ".wav",
  ".apk",
  ".exe",
];

export function isWechatUrl(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().includes("mp.weixin.qq.com");
  } catch {
    return false;
  }
}

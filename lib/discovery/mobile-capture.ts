import { randomUUID } from "crypto";

import { appendDiscoveryItem } from "@/agents/discovery/discovery-store";
import type { DiscoveryItem } from "@/agents/discovery/discovery-types";

export type CreateMobileCaptureInput = {
  title?: string;
  content: string;
  sourceNote?: string;
};

export type CreateMobileCaptureResult = {
  itemId: string;
  title: string;
  extractedUrl: string | null;
  isWechatArticle: boolean;
  duplicate: boolean;
};

const URL_RE = /https?:\/\/[^\s<>"'，。；、）)\]}]+/i;

function extractFirstUrl(content: string): string | null {
  const match = content.match(URL_RE);
  if (!match?.[0]) {
    return null;
  }
  return match[0].replace(/[.,;:!?，。；：！？]+$/g, "");
}

function titleFromContent(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 40 ? `${compact.slice(0, 40)}...` : compact;
}

function hostnameFromUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function sourceMaterialTypeFromUrl(
  extractedUrl: string | null,
  isWechatArticle: boolean,
): "wechat_article_link" | "article_link" | "pasted_text" {
  if (isWechatArticle) {
    return "wechat_article_link";
  }
  if (extractedUrl) {
    return "article_link";
  }
  return "pasted_text";
}

function materialTitle(
  inputTitle: string | undefined,
  content: string,
  extractedUrl: string | null,
  isWechatArticle: boolean,
): string {
  const title = inputTitle?.trim();
  if (title) {
    return title;
  }
  if (isWechatArticle) {
    return "微信公众号文章链接";
  }
  if (extractedUrl) {
    return "文章链接";
  }
  return titleFromContent(content) || "pasted text";
}

export function isSourceMaterialDiscoveryItem(item: Pick<DiscoveryItem, "meta">): boolean {
  return (
    item.meta?.itemKind === "source_material" ||
    item.meta?.needsExtraction === true ||
    item.meta?.captureType === "mobile"
  );
}

export async function createMobileCaptureItem(
  input: CreateMobileCaptureInput,
): Promise<CreateMobileCaptureResult> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("content is required");
  }

  const id = `mobile-${randomUUID()}`;
  const now = new Date().toISOString();
  const extractedUrl = extractFirstUrl(content);
  const host = hostnameFromUrl(extractedUrl);
  const isWechatArticle = Boolean(host?.toLowerCase().includes("mp.weixin.qq.com"));
  const title = materialTitle(input.title, content, extractedUrl, isWechatArticle);
  const sourceNote = input.sourceNote?.trim() || "";
  const sourceMaterialType = sourceMaterialTypeFromUrl(extractedUrl, isWechatArticle);
  const url = extractedUrl || `mobile-capture://${id}`;

  const item: DiscoveryItem = {
    id,
    sourceType: "other",
    title,
    url,
    description: content.length > 240 ? `${content.slice(0, 240)}...` : content,
    status: "new",
    createdAt: now,
    meta: {
      source: sourceNote || "手机采集箱",
      sourceKey: "mobile-capture",
      sourceLabel: "手机采集箱",
      captureType: "mobile",
      itemKind: "source_material",
      needsExtraction: true,
      sourceMaterialType,
      sourceNote: sourceNote || null,
      extractedUrl,
      isWechatArticle,
      capturedAt: now,
      articleTitle: title,
      articleBody: content,
      sourceName: sourceNote || "手机采集箱",
      url,
    },
  };

  const { duplicate } = await appendDiscoveryItem(item);
  return {
    itemId: id,
    title,
    extractedUrl,
    isWechatArticle,
    duplicate,
  };
}

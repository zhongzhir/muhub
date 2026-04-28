import type { ProjectSourceKind } from "@prisma/client";

/**
 * 根据 URL 启发式识别来源类型（小写字符串，供表单与日志使用）。
 * 未命中特定宿主时返回 `website`。
 */
export function detectSourceType(url: string): string {
  const lower = url.trim().toLowerCase();
  if (!lower) {
    return "website";
  }
  if (lower.includes("github.com")) {
    return "github";
  }
  if (lower.includes("gitee.com")) {
    return "gitee";
  }
  if (lower.includes("gitcc.com")) {
    return "gitcc";
  }
  if (lower.includes("mp.weixin.qq.com") || lower.includes("weixin.qq.com")) {
    return "wechat";
  }
  if (lower.includes("xiaohongshu.com") || lower.includes("xhslink.com")) {
    return "xiaohongshu";
  }
  if (
    lower.includes("douyin.com") ||
    lower.includes("iesdouyin.com") ||
    lower.includes("v.douyin.com")
  ) {
    return "douyin";
  }
  if (lower.includes("zhihu.com")) {
    return "zhihu";
  }
  if (lower.includes("bilibili.com") || lower.includes("b23.tv")) {
    return "bilibili";
  }
  if (lower.includes("twitter.com") || lower.includes("x.com")) {
    return "twitter";
  }
  if (lower.includes("discord.com") || lower.includes("discord.gg")) {
    return "discord";
  }
  return "website";
}

/** 与 Prisma `ProjectSourceKind` 对齐。 */
export function detectSourceUrlKind(url: string): ProjectSourceKind {
  const t = detectSourceType(url);
  switch (t) {
    case "github":
      return "GITHUB";
    case "gitee":
      return "GITEE";
    case "gitcc":
      return "OTHER";
    case "wechat":
      return "WECHAT";
    case "xiaohongshu":
      return "XIAOHONGSHU";
    case "douyin":
      return "DOUYIN";
    case "zhihu":
      return "ZHIHU";
    case "bilibili":
      return "BILIBILI";
    case "twitter":
      return "TWITTER";
    case "discord":
      return "DISCORD";
    case "website":
    default:
      return "WEBSITE";
  }
}

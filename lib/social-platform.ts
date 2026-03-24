import type { SocialPlatform } from "@prisma/client";

const LABELS: Record<SocialPlatform, string> = {
  WEIBO: "微博",
  WECHAT_OFFICIAL: "微信公众号",
  WECHAT_CHANNELS: "微信视频号",
  DOUYIN: "抖音",
  XIAOHONGSHU: "小红书",
  BILIBILI: "哔哩哔哩",
  X: "X（Twitter）",
  DISCORD: "Discord",
  REDDIT: "Reddit",
};

export function socialPlatformLabel(platform: SocialPlatform): string {
  return LABELS[platform] ?? platform;
}

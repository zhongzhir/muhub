/** 内置演示数据：仅在数据库中无对应 slug 且访问 demo 时使用 */

import type {
  ClaimStatus,
  ProjectStatus,
  ProjectUpdateSourceType,
  SocialPlatform,
} from "@prisma/client";

export type DemoSocial = { platform: SocialPlatform; accountName: string; accountUrl?: string };
export type DemoUpdate = {
  id?: string;
  sourceType: ProjectUpdateSourceType;
  /** 展示用来源文案，覆盖默认映射 */
  sourceLabel?: string;
  title: string;
  summary?: string;
  content?: string;
  sourceUrl?: string;
  /** 扩展元数据（JSON 文本），供后续 webhook / 社媒等使用 */
  metaJson?: string;
  isAiGenerated?: boolean;
  occurredAt: Date;
  createdAt?: Date;
};

export type GithubSnapshotView = {
  /** 快照写入的平台；旧数据可为空，由页面用仓库 URL 推断 */
  repoPlatform?: "github" | "gitee";
  repoOwner?: string;
  repoName?: string;
  repoFullName: string;
  defaultBranch?: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  commitCount7d: number;
  commitCount30d: number;
  contributorsCount: number;
  lastCommitAt?: Date;
  /** 本条快照写入时间（仅数据库快照） */
  fetchedAt?: Date;
  latestReleaseTag?: string;
  latestReleaseAt?: Date;
};

/** 项目详情页展示用数据结构 */
export type ProjectPageView = {
  slug: string;
  name: string;
  /** 项目 Logo URL（可选；分享页等用于展示） */
  logoUrl?: string;
  tagline?: string;
  description: string;
  /** AI/导入生成的轻量标签 */
  tags?: string[];
  websiteUrl?: string;
  githubUrl?: string;
  /** 数据库项目无刷新记录时为 null */
  githubSnapshot: GithubSnapshotView | null;
  socials: DemoSocial[];
  updates: DemoUpdate[];
  status: ProjectStatus;
  createdAt: Date;
  claimStatus: ClaimStatus;
  claimedAt: Date | null;
  claimedBy: string | null;
  /** 库内来源标记：seed / import / manual 等 */
  sourceType?: string | null;
  isFeatured?: boolean;
};

export const demoProjectView: ProjectPageView = {
  slug: "demo",
  name: "示例开源项目",
  tagline: "MUHUB 演示项目的标语示例",
  description:
    "这是一个用于展示项目详情页布局的示例项目，包含 GitHub 卡片、社媒与动态流等模块。",
  tags: ["开源", "演示", "MUHUB"],
  websiteUrl: "https://example.com",
  githubUrl: "https://github.com/example/demo",
  githubSnapshot: {
    repoPlatform: "github",
    repoOwner: "example",
    repoName: "demo",
    repoFullName: "example/demo",
    defaultBranch: "main",
    stars: 128,
    forks: 24,
    openIssues: 5,
    watchers: 12,
    commitCount7d: 14,
    commitCount30d: 48,
    contributorsCount: 9,
    lastCommitAt: new Date("2026-03-20T10:00:00.000Z"),
    latestReleaseTag: "v1.2.0",
    latestReleaseAt: new Date("2026-03-18T08:00:00.000Z"),
  },
  socials: [
    {
      platform: "WEIBO",
      accountName: "@DemoWeibo",
      accountUrl: "https://weibo.com/demo",
    },
    { platform: "WECHAT_OFFICIAL", accountName: "公众号 DemoOfficial" },
    { platform: "DOUYIN", accountName: "抖音 @demolab" },
    { platform: "XIAOHONGSHU", accountName: "小红书 DemoLife" },
  ] satisfies DemoSocial[],
  updates: [
    {
      id: "demo-update-1",
      sourceType: "GITHUB",
      title: "v1.2.0 发布",
      summary: "本版本聚焦性能与可访问性改进，并修复若干边界问题（演示用 AI 摘要样式）。",
      isAiGenerated: true,
      sourceUrl: "https://github.com/example/demo/releases/tag/v1.2.0",
      occurredAt: new Date("2026-03-18T09:00:00.000Z"),
      createdAt: new Date("2026-03-18T09:00:00.000Z"),
    },
    {
      id: "demo-update-2",
      sourceType: "MANUAL",
      sourceLabel: "手动发布",
      title: "架构演进笔记",
      summary: "记录近期模块拆分与缓存策略。",
      content: "本期将核心模块拆分为独立包，并调整了静态资源的缓存策略。",
      occurredAt: new Date("2026-03-10T14:30:00.000Z"),
      createdAt: new Date("2026-03-10T14:30:00.000Z"),
    },
    {
      id: "demo-update-3",
      sourceType: "OFFICIAL",
      title: "官网 Changelog 摘录",
      summary: "展示「官方动态」来源样式（第一版架构预留）。",
      sourceUrl: "https://example.com/changelog",
      occurredAt: new Date("2026-03-05T12:00:00.000Z"),
      createdAt: new Date("2026-03-05T12:00:00.000Z"),
    },
  ] satisfies DemoUpdate[],
  status: "ACTIVE",
  createdAt: new Date("2026-01-01T08:00:00.000Z"),
  claimStatus: "UNCLAIMED",
  claimedAt: null,
  claimedBy: null,
};

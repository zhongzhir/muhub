/** 内置演示数据，供 /projects/demo 与无数据库环境下的 E2E 使用 */

export type DemoSocial = { platform: string; accountName: string; accountUrl?: string };
export type DemoUpdate = {
  sourceType: string;
  title: string;
  summary?: string;
  sourceUrl?: string;
  occurredAt: Date;
};

export type GithubSnapshotView = {
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
};

/** 项目详情页展示用数据结构（演示数据与数据库行映射共用） */
export type ProjectPageView = {
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  websiteUrl?: string;
  githubUrl?: string;
  githubSnapshot: GithubSnapshotView;
  socials: DemoSocial[];
  updates: DemoUpdate[];
  about: string;
};

export const demoProjectView: ProjectPageView = {
  slug: "demo",
  name: "示例开源项目",
  tagline: "MUHUB 演示用项目主页",
  description: "这是一个用于展示项目详情页布局的示例项目，包含 GitHub 卡片、社媒与动态流等模块。",
  websiteUrl: "https://example.com",
  githubUrl: "https://github.com/example/demo",
  githubSnapshot: {
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
  },
  socials: [
    { platform: "weibo", accountName: "@DemoWeibo", accountUrl: "https://weibo.com/demo" },
    { platform: "wechat", accountName: "公众号 DemoOfficial" },
    { platform: "douyin", accountName: "抖音 @demolab" },
    { platform: "xiaohongshu", accountName: "小红书 DemoLife" },
  ] satisfies DemoSocial[],
  updates: [
    {
      sourceType: "release",
      title: "v1.2.0 发布",
      summary: "改进性能与可访问性。",
      sourceUrl: "https://github.com/example/demo/releases/tag/v1.2.0",
      occurredAt: new Date("2026-03-18T09:00:00.000Z"),
    },
    {
      sourceType: "blog",
      title: "架构演进笔记",
      summary: "记录近期模块拆分与缓存策略。",
      occurredAt: new Date("2026-03-10T14:30:00.000Z"),
    },
  ] satisfies DemoUpdate[],
  about:
    "介绍：本项目页展示「项目名称、简介、GitHub 卡片、社媒卡片、动态流、介绍」等区块，便于后续接入真实数据与 Prisma。",
};

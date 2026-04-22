import type { Prisma } from "@prisma/client";
import { DiscoverySourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_TOPICS_CONFIG: Prisma.InputJsonValue = {
  topics: [
    "ai",
    "agent",
    "llm",
    "open-source-ai",
    "rag",
    "workflow-automation",
  ],
  perPage: 30,
  sort: "stars",
};

const DEFAULT_TRENDING_CONFIG: Prisma.InputJsonValue = {
  since: "daily",
  programmingLanguage: "",
  spokenLanguageCode: "",
  maxRepos: 25,
};

/**
 * Product Hunt GraphQL：`PostsOrder` 枚举
 * FEATURED_AT | NEWEST | RANKING | VOTES
 */
const DEFAULT_PRODUCTHUNT_FEATURED_CONFIG: Prisma.InputJsonValue = {
  postCount: 20,
  order: "RANKING",
  /** true 时仅 featured 帖（对应 API posts(featured: true)）；默认 false 与官网一致 */
  featuredOnly: false,
};

/** `posts(topic: slug)` 的话题 slug，见 PH 站内，如 artificial-intelligence */
const DEFAULT_PRODUCTHUNT_AI_CONFIG: Prisma.InputJsonValue = {
  topicSlug: "artificial-intelligence",
  postCount: 20,
  order: "RANKING",
};

/** E2E / 开发：机构目录占位（example.com 列表解析可为 0 条） */
const TEST_INSTITUTION_CONFIG: Prisma.InputJsonValue = {
  id: "test-institution",
  name: "测试产业园（占位）",
  url: "https://example.com/projects",
  mode: "website_list",
  type: "incubator",
  region: "demo",
};

/** 深圳市人工智能产业协会：会员动态 / 资讯列表（article_feed，首页由通用链式解析抽取线索） */
const SZAICX_MEMBER_FEED_CONFIG: Prisma.InputJsonValue = {
  mode: "article_feed",
  url: "https://www.szaicx.com/",
  id: "szaicx-member-feed",
  name: "深圳市人工智能产业协会会员动态",
};

/** 手工种子：无需抓取外网，便于调试 institution 写入与 metadata */
const TEST_INSTITUTION_MANUAL_SEED_CONFIG: Prisma.InputJsonValue = {
  id: "test-manual-seed",
  name: "测试机构（manual_seed）",
  url: "",
  mode: "manual_seed",
  type: "demo",
  region: "local",
  seedItems: [
    {
      title: "种子项目 Alpha",
      summary: "用于验证 manual_seed adapter",
      website: "https://example.com/alpha",
    },
    {
      title: "种子项目 Beta",
      website: "https://example.com/beta",
    },
  ],
};

const NEWS_SIGNAL_SEED_CONFIG: Prisma.InputJsonValue = {
  signals: [
    {
      signalType: "NEWS",
      title: "示例AI项目发布新版本",
      summary: "该项目发布了新版本，并宣布开放更多企业功能。",
      url: "https://example.com/news/ai-project-release",
      rawText: "示例AI项目发布新版本，官网 https://example.com，代码仓库 https://github.com/example/ai-project",
    },
  ],
};

const SOCIAL_SIGNAL_SEED_CONFIG: Prisma.InputJsonValue = {
  signals: [
    {
      signalType: "SOCIAL",
      title: "某开发者在社交平台分享 Agent 工具",
      summary: "社交讨论热度上升，疑似可转化为候选项目。",
      url: "https://example.com/social/agent-thread",
      rawText: "Thread 提到项目主页 https://agent.example.com",
    },
  ],
};

const BLOG_SIGNAL_SEED_CONFIG: Prisma.InputJsonValue = {
  signals: [
    {
      signalType: "BLOG",
      title: "技术博客：开源数据工具完成融资",
      summary: "博客中包含项目主页与 GitHub 链接。",
      url: "https://example.com/blog/data-tool-funding",
      rawText: "项目地址 https://datatool.example.com GitHub https://github.com/example/data-tool",
    },
  ],
};

/**
 * 首次部署时插入默认来源；不覆盖运营已在后台改过配置的行。
 */
export async function ensureDiscoveryDefaultSources(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    return;
  }

  const rows: Array<{
    key: string;
    name: string;
    type: DiscoverySourceType;
    subtype: string;
    configJson: Prisma.InputJsonValue;
    institutionName?: string;
    institutionType?: string;
    institutionRegion?: string;
  }> = [
    {
      key: "github-topics",
      name: "GitHub Topics",
      type: DiscoverySourceType.GITHUB,
      subtype: "topic",
      configJson: DEFAULT_TOPICS_CONFIG,
    },
    {
      key: "github-trending",
      name: "GitHub Trending",
      type: DiscoverySourceType.GITHUB,
      subtype: "trending",
      configJson: DEFAULT_TRENDING_CONFIG,
    },
    {
      key: "producthunt-featured",
      name: "Product Hunt · 榜单",
      type: DiscoverySourceType.PRODUCTHUNT,
      subtype: "featured",
      configJson: DEFAULT_PRODUCTHUNT_FEATURED_CONFIG,
    },
    {
      key: "producthunt-ai",
      name: "Product Hunt · AI 主题",
      type: DiscoverySourceType.PRODUCTHUNT,
      subtype: "topic",
      configJson: DEFAULT_PRODUCTHUNT_AI_CONFIG,
    },
    {
      key: "test-institution",
      name: "测试机构目录（test-institution）",
      type: DiscoverySourceType.INSTITUTION,
      subtype: "directory",
      configJson: TEST_INSTITUTION_CONFIG,
      institutionName: "测试产业园（占位）",
      institutionType: "incubator",
      institutionRegion: "demo",
    },
    {
      key: "test-institution-manual-seed",
      name: "测试机构 · manual_seed",
      type: DiscoverySourceType.INSTITUTION,
      subtype: "manual_seed",
      configJson: TEST_INSTITUTION_MANUAL_SEED_CONFIG,
      institutionName: "测试机构（manual_seed）",
      institutionType: "demo",
      institutionRegion: "local",
    },
    {
      key: "szaicx-member-feed",
      name: "深圳AI产业协会 · 会员动态",
      type: DiscoverySourceType.INSTITUTION,
      subtype: "article_feed",
      configJson: SZAICX_MEMBER_FEED_CONFIG,
      institutionName: "深圳市人工智能产业协会",
      institutionType: "协会",
      institutionRegion: "深圳",
    },
    {
      key: "news-signal-seed",
      name: "新闻线索（seed）",
      type: DiscoverySourceType.NEWS,
      subtype: "manual_seed",
      configJson: NEWS_SIGNAL_SEED_CONFIG,
    },
    {
      key: "social-signal-seed",
      name: "社交线索（seed）",
      type: DiscoverySourceType.SOCIAL,
      subtype: "manual_seed",
      configJson: SOCIAL_SIGNAL_SEED_CONFIG,
    },
    {
      key: "blog-signal-seed",
      name: "博客线索（seed）",
      type: DiscoverySourceType.BLOG,
      subtype: "manual_seed",
      configJson: BLOG_SIGNAL_SEED_CONFIG,
    },
  ];

  for (const r of rows) {
    const existing = await prisma.discoverySource.findUnique({
      where: { key: r.key },
      select: { id: true },
    });
    if (existing) {
      continue;
    }
    await prisma.discoverySource.create({
      data: {
        key: r.key,
        name: r.name,
        type: r.type,
        subtype: r.subtype,
        status: "ACTIVE",
        configJson: r.configJson,
        institutionName: r.institutionName ?? null,
        institutionType: r.institutionType ?? null,
        institutionRegion: r.institutionRegion ?? null,
      },
    });
  }
}

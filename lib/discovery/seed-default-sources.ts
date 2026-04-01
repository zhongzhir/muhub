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

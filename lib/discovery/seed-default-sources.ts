import type { Prisma } from "@prisma/client";
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
    type: string;
    subtype: string;
    configJson: Prisma.InputJsonValue;
  }> = [
    {
      key: "github-topics",
      name: "GitHub Topics",
      type: "GITHUB",
      subtype: "topic",
      configJson: DEFAULT_TOPICS_CONFIG,
    },
    {
      key: "github-trending",
      name: "GitHub Trending",
      type: "GITHUB",
      subtype: "trending",
      configJson: DEFAULT_TRENDING_CONFIG,
    },
    {
      key: "producthunt-featured",
      name: "Product Hunt · 榜单",
      type: "PRODUCTHUNT",
      subtype: "featured",
      configJson: DEFAULT_PRODUCTHUNT_FEATURED_CONFIG,
    },
    {
      key: "producthunt-ai",
      name: "Product Hunt · AI 主题",
      type: "PRODUCTHUNT",
      subtype: "topic",
      configJson: DEFAULT_PRODUCTHUNT_AI_CONFIG,
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
      },
    });
  }
}

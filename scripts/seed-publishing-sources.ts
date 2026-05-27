/**
 * 出版行业信息源种子脚本
 *
 * 向 DiscoverySource 表写入出版传媒行业相关信息源。
 * 可重复执行，已存在 key 则跳过。
 *
 * 运行：
 *   pnpm tsx scripts/seed-publishing-sources.ts
 * 或：
 *   node --env-file=.env --loader tsx scripts/seed-publishing-sources.ts
 *
 * 需要环境变量：DATABASE_URL
 */

import { PrismaClient, DiscoverySourceType, DiscoverySourceStatus } from "@prisma/client";

const PUBLISHING_SCOPE = ["publishing_ai"] as const;

function withPublishingScope(configJson: Record<string, unknown>): Record<string, unknown> {
  const mode = configJson.mode;
  let sourceKind = configJson.sourceKind;
  if (!sourceKind) {
    if (mode === "rss") {
      sourceKind = "RSS";
    } else if (mode === "github_topic") {
      sourceKind = "GITHUB_TOPIC";
    } else if (mode === "website_list") {
      sourceKind = "WEBSITE";
    } else {
      sourceKind = "OTHER";
    }
  }
  return {
    ...configJson,
    industry: configJson.industry ?? "publishing",
    scopes: [...PUBLISHING_SCOPE],
    sourceOwner: configJson.sourceOwner ?? "system",
    sourceKind,
    filterMode: configJson.filterMode ?? "relaxed",
    requireAiHint: false,
  };
}

const prisma = new PrismaClient();

type SourceDef = {
  key: string;
  name: string;
  type: DiscoverySourceType;
  subtype?: string;
  description?: string;
  configJson: Record<string, unknown>;
  status: DiscoverySourceStatus;
};

/**
 * 出版行业信息源定义
 *
 * 分三组：
 * 1. 国际出版媒体（RSS可用）
 * 2. 国际出版行业博客/新闻（RSS/抓取）
 * 3. 国内出版行业媒体（占位，逐步补充真实URL）
 */
const PUBLISHING_SOURCES: SourceDef[] = [
  // ──────────────────────────────────────────
  // 国际：出版行业核心媒体
  // ──────────────────────────────────────────
  {
    key: "publishing-publishers-weekly",
    name: "Publishers Weekly",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_international",
    description: "美国出版行业权威媒体，覆盖图书、数字出版、AI应用等",
    configJson: withPublishingScope({
      mode: "rss",
      sourceKind: "RSS",
      url: "https://www.publishersweekly.com/pw/feeds/recent/index.xml",
      label: "Publishers Weekly RSS",
      region: "us",
      filterMode: "relaxed",
    }),
    status: DiscoverySourceStatus.PAUSED,
  },
  {
    key: "publishing-the-bookseller",
    name: "The Bookseller",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_international",
    description: "英国出版行业领先媒体（RSS 待修复）",
    configJson: withPublishingScope({
      mode: "rss",
      sourceKind: "RSS",
      url: "https://www.thebookseller.com/rss.xml",
      label: "The Bookseller RSS",
      region: "uk",
    }),
    status: DiscoverySourceStatus.PAUSED,
  },
  {
    key: "publishing-hot-sheet",
    name: "The Hot Sheet",
    type: DiscoverySourceType.BLOG,
    subtype: "publishing_international",
    description: "面向出版业专业人士的新闻通讯（RSS 404，待修复）",
    configJson: withPublishingScope({
      mode: "rss",
      sourceKind: "RSS",
      url: "https://hotsheetpub.com/feed/",
      label: "Hot Sheet RSS",
      region: "us",
    }),
    status: DiscoverySourceStatus.PAUSED,
  },
  {
    key: "publishing-alli-blog",
    name: "ALLi (Alliance of Independent Authors) Blog",
    type: DiscoverySourceType.BLOG,
    subtype: "publishing_international",
    description: "独立作者联盟，关注AI写作工具与自助出版技术",
    configJson: withPublishingScope({
      mode: "rss",
      sourceKind: "RSS",
      url: "https://selfpublishingadvice.org/feed/",
      label: "ALLi Blog RSS",
      region: "international",
      filterMode: "relaxed",
    }),
    status: DiscoverySourceStatus.ACTIVE,
  },
  {
    key: "publishing-jane-friedman",
    name: "Jane Friedman Blog",
    type: DiscoverySourceType.BLOG,
    subtype: "publishing_international",
    description: "出版行业资深博主，深度分析出版技术与AI工具趋势",
    configJson: withPublishingScope({
      mode: "rss",
      sourceKind: "RSS",
      url: "https://janefriedman.com/feed/",
      label: "Jane Friedman RSS",
      region: "us",
      filterMode: "relaxed",
    }),
    status: DiscoverySourceStatus.ACTIVE,
  },
  {
    key: "publishing-digital-book-world",
    name: "Digital Book World",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_international",
    description: "专注数字出版技术、电子书与出版AI应用",
    configJson: withPublishingScope({
      mode: "website_list",
      sourceKind: "WEBSITE",
      url: "https://www.digitalbookworld.com/",
      label: "Digital Book World",
      region: "us",
    }),
    status: DiscoverySourceStatus.PAUSED,
  },
  {
    key: "publishing-futurebook",
    name: "FutureBook (The Bookseller)",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_international",
    description: "The Bookseller旗下数字出版专栏（RSS 待修复）",
    configJson: withPublishingScope({
      mode: "rss",
      sourceKind: "RSS",
      url: "https://www.thebookseller.com/futurebook/rss.xml",
      label: "FutureBook RSS",
      region: "uk",
    }),
    status: DiscoverySourceStatus.PAUSED,
  },

  // ──────────────────────────────────────────
  // 国际：出版科技 / AI工具垂直
  // ──────────────────────────────────────────
  {
    key: "publishing-reedsy-blog",
    name: "Reedsy Blog",
    type: DiscoverySourceType.BLOG,
    subtype: "publishing_tools",
    description: "Reedsy出版服务平台博客，关注AI写作工具与出版流程",
    configJson: withPublishingScope({
      mode: "rss",
      sourceKind: "RSS",
      url: "https://blog.reedsy.com/feed/",
      label: "Reedsy Blog RSS",
      region: "international",
    }),
    status: DiscoverySourceStatus.PAUSED,
  },
  {
    key: "publishing-publishing-perspectives",
    name: "Publishing Perspectives",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_international",
    description: "国际出版行业媒体，覆盖全球出版技术与AI应用动态",
    configJson: withPublishingScope({
      mode: "rss",
      sourceKind: "RSS",
      url: "https://publishingperspectives.com/feed/",
      label: "Publishing Perspectives RSS",
      region: "international",
      filterMode: "relaxed",
    }),
    status: DiscoverySourceStatus.ACTIVE,
  },

  // ──────────────────────────────────────────
  // 国内：出版行业媒体（占位，待补充真实抓取配置）
  // ──────────────────────────────────────────
  {
    key: "publishing-cn-baidao",
    name: "百道网",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_china",
    description: "中国出版行业权威媒体，专注图书出版行业动态与数字化转型",
    configJson: {
      mode: "placeholder",
      url: "https://www.bookdao.com/",
      label: "百道网",
      region: "cn",
      industry: "publishing",
      note: "待补充RSS或抓取配置",
    },
    status: DiscoverySourceStatus.PAUSED, // 占位，待激活
  },
  {
    key: "publishing-cn-chubanshangwu",
    name: "出版商务周报",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_china",
    description: "中国出版业商业媒体，关注出版企业动态与行业政策",
    configJson: {
      mode: "placeholder",
      url: "https://www.cbbr.com.cn/",
      label: "出版商务周报",
      region: "cn",
      industry: "publishing",
      note: "待补充RSS或抓取配置",
    },
    status: DiscoverySourceStatus.PAUSED,
  },
  {
    key: "publishing-cn-cnpubg",
    name: "中国新闻出版广电报",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_china",
    description: "中宣部主管，中国出版传媒行业官方媒体",
    configJson: {
      mode: "placeholder",
      url: "http://www.cnpubg.com/",
      label: "中国新闻出版广电报",
      region: "cn",
      industry: "publishing",
      note: "待补充RSS或抓取配置",
    },
    status: DiscoverySourceStatus.PAUSED,
  },
  {
    key: "publishing-cn-chubanren",
    name: "出版人杂志",
    type: DiscoverySourceType.NEWS,
    subtype: "publishing_china",
    description: "面向出版业从业者的专业媒体，关注行业趋势与技术应用",
    configJson: {
      mode: "placeholder",
      url: "https://www.chubanren.com/",
      label: "出版人杂志",
      region: "cn",
      industry: "publishing",
      note: "待补充RSS或抓取配置",
    },
    status: DiscoverySourceStatus.PAUSED,
  },
  {
    key: "publishing-cn-xinhua-books",
    name: "新华书店总店资讯",
    type: DiscoverySourceType.INSTITUTION,
    subtype: "publishing_china",
    description: "新华书店总店发布的行业动态与数字化建设信息",
    configJson: {
      mode: "placeholder",
      url: "https://www.xinhua.cn/",
      label: "新华书店总店",
      region: "cn",
      industry: "publishing",
      note: "待补充具体抓取配置",
    },
    status: DiscoverySourceStatus.PAUSED,
  },

  // ──────────────────────────────────────────
  // GitHub：出版相关 topic 发现（Phase 2）
  // ──────────────────────────────────────────
  {
    key: "publishing-github-topics",
    name: "Publishing GitHub Topics",
    type: DiscoverySourceType.GITHUB,
    subtype: "topic",
    description: "GitHub topics：出版、数字出版、电子书等",
    configJson: withPublishingScope({
      mode: "github_topic",
      sourceKind: "GITHUB_TOPIC",
      topics: [
        "publishing",
        "digital-publishing",
        "ebook",
        "epub",
        "book-publishing",
        "self-publishing",
      ],
      perPage: 30,
      sort: "stars",
    }),
    status: DiscoverySourceStatus.ACTIVE,
  },
  {
    key: "publishing-github-ai-topics",
    name: "Publishing × AI GitHub Topics",
    type: DiscoverySourceType.GITHUB,
    subtype: "topic",
    description: "GitHub topics：出版场景 × AI 交叉",
    configJson: withPublishingScope({
      mode: "github_topic",
      sourceKind: "GITHUB_TOPIC",
      topics: ["writing-assistant", "ai-writing", "text-generation", "nlp", "llm"],
      perPage: 20,
      sort: "updated",
      requirePublishingKeyword: true,
    }),
    status: DiscoverySourceStatus.ACTIVE,
  },
];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[seed:publishing] 未设置 DATABASE_URL");
    process.exit(1);
  }

  console.log(`[seed:publishing] 开始写入 ${PUBLISHING_SOURCES.length} 个出版行业信息源…`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const raw of PUBLISHING_SOURCES) {
    const src = {
      ...raw,
      configJson: withPublishingScope(raw.configJson),
    };
    try {
      const existing = await prisma.discoverySource.findUnique({
        where: { key: src.key },
        select: { id: true, name: true, configJson: true },
      });

      if (existing) {
        const prev =
          existing.configJson && typeof existing.configJson === "object" && !Array.isArray(existing.configJson)
            ? (existing.configJson as Record<string, unknown>)
            : {};
        const merged = withPublishingScope({ ...prev, ...src.configJson });
        const changed =
          JSON.stringify(prev) !== JSON.stringify(merged) || existing.name !== src.name;
        if (changed) {
          await prisma.discoverySource.update({
            where: { id: existing.id },
            data: {
              configJson: merged as never,
              status: src.status,
              name: src.name,
            },
          });
          console.log(`  [UPD]  ${src.key} — sync config/status`);
          updated++;
        } else {
          console.log(`  [SKIP] ${src.key} (已存在: ${existing.name})`);
          skipped++;
        }
        continue;
      }

      await prisma.discoverySource.create({
        data: {
          key: src.key,
          name: src.name,
          type: src.type,
          subtype: src.subtype ?? null,
          configJson: src.configJson as never,
          status: src.status,
        },
      });

      console.log(`  [OK]   ${src.key} — ${src.name} [${src.status}]`);
      created++;
    } catch (err) {
      console.error(`  [ERR]  ${src.key}:`, err);
      failed++;
    }
  }

  console.log(
    `\n[seed:publishing-sources] 完成：新建 ${created}，更新 ${updated}，跳过 ${skipped}，失败 ${failed}`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

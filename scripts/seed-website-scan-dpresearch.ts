/**
 * 种子：数字出版研究 WEBSITE_SCAN 测试来源
 * pnpm tsx scripts/seed-website-scan-dpresearch.ts
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE_KEY = "publishing-website-scan-dpresearch";

async function main(): Promise<void> {
  const configJson = {
    mode: "website_scan",
    sourceKind: "WEBSITE_SCAN",
    sourceOwner: "manual",
    url: "http://dpresearch.bjzzcb.com/",
    startUrls: ["http://dpresearch.bjzzcb.com/"],
    allowedDomains: ["dpresearch.bjzzcb.com", "mp.weixin.qq.com"],
    maxDepth: 2,
    maxPages: 50,
    includeKeywords: [
      "AI",
      "人工智能",
      "大模型",
      "数字出版",
      "智能出版",
      "出版科技",
      "AIGC",
    ],
    excludePatterns: ["login", "search", "comment"],
    scopes: ["publishing_ai"],
    industry: "publishing",
  };

  const row = await prisma.discoverySource.upsert({
    where: { key: SOURCE_KEY },
    create: {
      key: SOURCE_KEY,
      name: "数字出版研究",
      type: "INSTITUTION",
      subtype: "website_scan",
      status: "ACTIVE",
      notes: "WEBSITE_SCAN MVP 测试来源 — 受控站点扫描",
      configJson: configJson as Prisma.InputJsonValue,
    },
    update: {
      name: "数字出版研究",
      status: "ACTIVE",
      configJson: configJson as Prisma.InputJsonValue,
    },
    select: { id: true, key: true },
  });

  console.log(JSON.stringify({ ok: true, source: row }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

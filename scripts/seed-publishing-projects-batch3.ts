/**
 * 出版行业 AI 工具项目库第三批种子脚本
 * 来源：微信公众号文章（方正电子、凤凰传媒、福建创智联盟等）
 *
 * 运行：pnpm seed:pub-projects-b3
 */

import { PrismaClient, ProjectStatus } from "@prisma/client";

const prisma = new PrismaClient();

type ProjectDef = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  websiteUrl?: string;
  githubUrl?: string;
  tags: string[];
  isChineseTool: boolean;
};

const BATCH3_PROJECTS: ProjectDef[] = [
  // ─────────────────────────────────────────
  // 方正电子 AI 出版产品线
  // ─────────────────────────────────────────
  {
    slug: "pub-fangzheng-xingkong",
    name: "方正星空AI出版平台",
    tagline: "方正电子出品，覆盖出版全链条的智能化一体平台",
    description:
      "北京方正电子有限公司推出的全流程智能出版解决方案，覆盖选题策划、内容创作辅助、智能编校、AI排版（5分钟完成图书版式）、封面智能生成与营销文案生产。已落地全国 400 余家出版机构。具备意识形态预审、三审三校辅助等中国出版合规特色功能。",
    websiteUrl: "https://www.founder.com",
    tags: ["编辑辅助", "排版设计", "内容审核", "出版流程管理", "营销推广"],
    isChineseTool: true,
  },
  {
    slug: "pub-fangzheng-yunque",
    name: "方正云雀",
    tagline: "方正电子智能媒资管理系统，激活出版机构沉睡资产",
    description:
      "方正电子旗下面向出版和媒体机构的 AI 媒资管理平台，通过智能分类、自动标签、内容检索等能力，将出版机构积累的海量图文音视频资产转化为可检索、可复用的数字资产库，有效盘活存量内容资源，支持多渠道二次传播。",
    websiteUrl: "https://www.founder.com",
    tags: ["内容管理", "数字资产", "智能检索"],
    isChineseTool: true,
  },
  {
    slug: "pub-fangzheng-hongyun",
    name: "方正鸿云",
    tagline: "方正电子学术出版 AI 平台，推动期刊智能化升级",
    description:
      "方正电子面向学术期刊与出版社的智能出版平台，聚焦学术内容的结构化处理、元数据自动生成、参考文献规范化与学术排版自动化。引入 AI 辅助实现稿件初审、格式检查和知识图谱构建，帮助学术出版机构降低人工成本、提升出版规范性。",
    websiteUrl: "https://www.founder.com",
    tags: ["学术出版", "元数据", "出版流程管理", "知识图谱"],
    isChineseTool: true,
  },
  {
    slug: "pub-fangzheng-mofang",
    name: "方正魔方智能创作器",
    tagline: "方正电子出品，更懂媒体人的 AI 内容创作助理",
    description:
      "方正电子旗下面向出版和媒体从业者的 AI 写作工具，支持多种文体和风格的内容生成、改写与润色，内置出版规范知识库，生成内容符合行业格式要求。尤其擅长营销文案、书评、简介等出版宣传物料的快速生产，帮助编辑释放创意生产力。",
    websiteUrl: "https://www.founder.com",
    tags: ["AI写作", "内容生成", "营销推广", "编辑辅助"],
    isChineseTool: true,
  },

  // ─────────────────────────────────────────
  // 凤凰传媒教育 AI 产品
  // ─────────────────────────────────────────
  {
    slug: "pub-fenghuang-zhiling",
    name: "凤凰智羚AI教育云矩阵",
    tagline: "凤凰传媒教育出版数智化旗舰产品，覆盖家校社全场景",
    description:
      "江苏凤凰出版传媒集团旗下面向教育出版与学校场景的 AI 智能教育产品矩阵，覆盖个性化作业、智能辅导、家校互动等全场景。结合凤凰传媒丰富的教材内容资源，提供从教材配套到课后辅助的闭环服务，已在江苏省内大面积推广并形成规模化应用。",
    websiteUrl: "https://www.ppm.cn",
    tags: ["教育出版", "智能辅导", "个性化学习", "家校互动"],
    isChineseTool: true,
  },

  // ─────────────────────────────────────────
  // 福建创智联盟
  // ─────────────────────────────────────────
  {
    slug: "pub-chuangzhi-huizuoye",
    name: "慧作业",
    tagline: "AI 智能批改系统，教师减负 65%，已服务百万师生",
    description:
      "福建创智联盟数字教育科技有限公司推出的教育出版 AI 应用，深度融合 OCR 版面识别、NLP 与知识图谱算法，实现主客观题全自动智能批改。自研 AI 批阅一体机支持纸质作业即扫即改，内置全学段智慧题库。已在福州、泉州、厦门等地规模化落地，服务超百万人次，教师批改负担平均减少 65%，入选福建省教育厅 2025 年度人工智能+教育典型案例。",
    websiteUrl: "https://www.fjczkm.com",
    tags: ["教育出版", "智能批改", "AI写作", "知识图谱"],
    isChineseTool: true,
  },
];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[seed:pub-projects-b3] 未设置 DATABASE_URL");
    process.exit(1);
  }

  console.log(`[seed:pub-projects-b3] 开始写入 ${BATCH3_PROJECTS.length} 个项目（第三批）...\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of BATCH3_PROJECTS) {
    try {
      const existing = await prisma.project.findUnique({
        where: { slug: p.slug },
        select: { id: true, name: true },
      });
      if (existing) {
        console.log(`  [SKIP] ${p.slug} (已存在: ${existing.name})`);
        skipped++;
        continue;
      }
      await prisma.project.create({
        data: {
          slug: p.slug,
          name: p.name,
          tagline: p.tagline,
          description: p.description,
          websiteUrl: p.websiteUrl ?? null,
          githubUrl: p.githubUrl ?? null,
          tags: p.tags,
          primaryCategory: "publishing_media",
          categoriesJson: ["publishing_media"],
          isAiRelated: true,
          isChineseTool: p.isChineseTool,
          status: ProjectStatus.PUBLISHED,
          sourceType: "seed",
          isFeatured: false,
        },
      });
      console.log(`  [OK]   ${p.slug} — ${p.name}`);
      created++;
    } catch (err) {
      console.error(`  [ERR]  ${p.slug}:`, err);
      failed++;
    }
  }

  console.log(`\n[seed:pub-projects-b3] 完成：新建 ${created}，跳过 ${skipped}，失败 ${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

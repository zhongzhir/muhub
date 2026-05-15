/**
 * 出版行业 AI 工具项目库第二批种子脚本
 * 来源：出版技术服务供应商资料.docx
 *
 * 运行：pnpm seed:pub-projects-b2
 */

import { PrismaClient, ProjectStatus, ProjectVisibilityStatus } from "@prisma/client";

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

const BATCH2_PROJECTS: ProjectDef[] = [
  // ─────────────────────────────────────────
  // 国际学术出版平台与工具
  // ─────────────────────────────────────────
  {
    slug: "pub-editorial-manager",
    name: "Editorial Manager",
    tagline: "全球最广泛使用的学术期刊投稿与同行评议系统",
    description:
      "由 Aries Systems 开发的学术期刊采编管理平台，被 Elsevier、Springer Nature、Taylor & Francis 等顶级出版商采用，是国际学术出版工作流的核心基础设施。覆盖稿件投递、同行评议、编辑决策到出版接受的全流程数字化管理。",
    websiteUrl: "https://www.editorialmanager.com",
    tags: ["出版流程管理", "内容审核"],
    isChineseTool: false,
  },
  {
    slug: "pub-scholarone",
    name: "ScholarOne Manuscripts",
    tagline: "Clarivate 旗下期刊投稿系统，全球 9000+ 期刊采用",
    description:
      "Clarivate 旗下学术期刊稿件管理平台，服务 Wiley、剑桥大学出版社、牛津大学出版社、IEEE、ACS、SAGE 等机构，全球年处理 300 万+ 稿件。2024 年被 Silverchair 收购，持续整合 AI 审稿与诚信工具生态。",
    websiteUrl: "https://clarivate.com/products/scholarone/",
    tags: ["出版流程管理", "内容审核"],
    isChineseTool: false,
  },
  {
    slug: "pub-silverchair",
    name: "Silverchair",
    tagline: "学术出版内容托管与数字化平台，服务 400+ 出版商",
    description:
      "领先的独立学术出版内容托管与产品化平台，服务超过 400 家出版商，覆盖学协会、大学出版社和商业出版商。通过 Silverchair Universe 合作伙伴网络，允许出版商零成本集成第三方 AI 分析和诚信工具。2024 年收购 ScholarOne 实现从投稿到发布的纵向整合。",
    websiteUrl: "https://silverchair.com",
    tags: ["数字出版平台", "出版流程管理"],
    isChineseTool: false,
  },
  {
    slug: "pub-paperpal",
    name: "Paperpal",
    tagline: "CACTUS 出品的学术论文 AI 写作与投稿合规检查工具",
    description:
      "CACTUS Communications 旗下 AI 学术写作辅助平台，提供语言质量评分、语法错误标记、期刊合规性比对等功能。Wiley 是其战略合作伙伴，已集成进多个期刊投稿工作流，适合学术作者、期刊编辑和出版商用于稿件预审与质量把控。",
    websiteUrl: "https://paperpal.com",
    tags: ["编辑校对", "写作辅助", "内容审核"],
    isChineseTool: false,
  },
  {
    slug: "pub-ithenticate",
    name: "iThenticate",
    tagline: "学术出版行业标准抄袭检测工具，覆盖 9000 万+ 文献",
    description:
      "Turnitin 旗下专为研究人员和出版商设计的学术抄袭检测服务，通过 Crossref 的 CrossCheck 程序覆盖超 9000 万篇学术文献，深度集成于主流期刊投稿系统，是学术出版诚信审查的行业标准工具。",
    websiteUrl: "https://www.ithenticate.com",
    tags: ["内容审核", "智能校对"],
    isChineseTool: false,
  },
  {
    slug: "pub-figshare",
    name: "Figshare",
    tagline: "Digital Science 旗下学术研究数据存储与共享平台",
    description:
      "Digital Science 旗下研究数据存储解决方案，是 Nature、Springer 等大型出版商的核心数据存储与共享基础设施，支持数据集、图表、代码等多类型研究成果的托管与 DOI 注册。",
    websiteUrl: "https://figshare.com",
    tags: ["数字资产管理", "元数据处理"],
    isChineseTool: false,
  },
  {
    slug: "pub-crossref",
    name: "Crossref",
    tagline: "全球学术出版 DOI 注册与元数据基础设施",
    description:
      "学术出版行业的非营利性元数据注册机构，负责 DOI 注册与文献互引基础设施，近 90% 的 DOAJ 期刊在其系统中注册，与 ORCID 共同构成学术出版身份与引用的核心基础设施。",
    websiteUrl: "https://www.crossref.org",
    tags: ["元数据处理", "数字资产管理"],
    isChineseTool: false,
  },
  {
    slug: "pub-mineru",
    name: "MinerU",
    tagline: "上海 AI 实验室开源文档智能解析工具，让文档一键变 AI-Ready 数据",
    description:
      "上海人工智能实验室开发的开源文档智能解析工具，专攻科学文献格式复杂、精度要求高的解析难题，支持 PDF、Word、图表等多种格式转化为结构化 AI-Ready 数据。自 2024 年 7 月开源以来已处理超 6 亿页文档，成为学术出版数字化转型的行业事实基准。",
    websiteUrl: "https://github.com/opendatalab/MinerU",
    githubUrl: "https://github.com/opendatalab/MinerU",
    tags: ["档案数字化", "元数据处理"],
    isChineseTool: true,
  },

  // ─────────────────────────────────────────
  // 国内出版 AI 解决方案
  // ─────────────────────────────────────────
  {
    slug: "pub-booksgpt",
    name: "书翼 AI 编辑工作室",
    tagline: "数传集团出版专属大模型 BooksGPT 驱动的全流程 AI 编辑工具",
    description:
      "数传集团基于自研出版行业大模型 BooksGPT 打造的 AI 编辑工作室，覆盖选题策划、编辑组稿、三审三校、设计排版、营销发行等全流程。已服务近 400 家出版发行单位、1.5 万名编辑，累计使用时长超 40 万小时，是国内出版行业最成熟的 AI 编辑工具之一。",
    websiteUrl: "https://www.dcrays.cn",
    tags: ["写作辅助", "编辑校对", "选题策划", "出版流程管理"],
    isChineseTool: true,
  },
  {
    slug: "pub-founder-xingkong",
    name: "方正星空 AI 出版平台",
    tagline: "方正电子全链条智能出版解决方案，已落地 400+ 机构",
    description:
      "方正电子基于 AI 技术打造的全流程智能出版平台，覆盖选题策划、编辑加工、排版制作、营销传播、流程管理等核心环节。提供智能编校、5 分钟完成图书排版、AI 封面设计、多渠道营销文案自动生成等功能，已落地全国 400 余家出版机构。",
    websiteUrl: "https://www.founderss.cn",
    tags: ["编辑校对", "选题策划", "营销文案", "出版流程管理"],
    isChineseTool: true,
  },
  {
    slug: "pub-tencent-cloud-pub",
    name: "腾讯云智能出版平台",
    tagline: "腾讯云混元大模型驱动的出版全链路 AI 协同解决方案",
    description:
      "腾讯云面向出版行业推出的智能出版全流程协同平台，整合混元大模型、大数据分析与云原生技术，贯穿选题-生产-营销-发行全链路。支持 AI 工具拖拽式部署，联合多家科技类出版社共建可信数据空间，降低出版机构 AI 落地门槛。",
    websiteUrl: "https://cloud.tencent.com/solution/publishing",
    tags: ["出版流程管理", "数字出版平台", "选题策划"],
    isChineseTool: true,
  },
  {
    slug: "pub-fenghuang-zhingling",
    name: "凤凰智灵 AI",
    tagline: "凤凰传媒出版全链路 AI 平台，有声书成本降低 99%",
    description:
      "江苏凤凰出版传媒集团推出的出版行业 AI 平台，集成双引擎审校、选题策划、多模态营销物料生成、有声书制作等功能。长文本朗读功能将 10 万字有声书制作成本从 1 万元降至 100 元，制作周期从 2 周压缩至 4 小时，月均处理文稿超千万字。",
    websiteUrl: "https://www.ppm.cn",
    tags: ["有声书生成", "编辑校对", "营销文案", "出版流程管理"],
    isChineseTool: true,
  },
  {
    slug: "pub-zhongtu-kexin",
    name: "中图科信",
    tagline: "中图集团旗下 AI 知识服务与出版数智化技术平台",
    description:
      "中国图书进出口集团旗下数智技术公司，专注出版行业知识服务转型升级，提供 AI 驱动的知识管理解决方案。参与出版业人工智能应用指南行业标准研制，联合国家实验室与顶级出版社推动出版知识服务生态建设，推动出版机构从内容提供向智能知识服务转型。",
    websiteUrl: "https://www.capub.cn",
    tags: ["数字出版平台", "出版流程管理"],
    isChineseTool: true,
  },
  {
    slug: "pub-jiusi-oa",
    name: "九思协同管理平台",
    tagline: "面向新闻出版行业的一体化协同管理与 OA 系统",
    description:
      "九思软件针对新闻出版企业推出的智能综合管理平台，覆盖编务管理（选题策划、三审三校、版权申请）、印务管理、出版发行管理、人力资源管理等核心模块，打破财务、编务、发行系统数据孤岛，实现出版全业务流程的信息化与协同化管理。",
    websiteUrl: "https://www.juessoft.com",
    tags: ["出版流程管理"],
    isChineseTool: true,
  },
];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[seed:pub-projects-b2] 未设置 DATABASE_URL");
    process.exit(1);
  }

  console.log(`[seed:pub-projects-b2] 开始写入 ${BATCH2_PROJECTS.length} 个项目（第二批）...\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of BATCH2_PROJECTS) {
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
          visibilityStatus: ProjectVisibilityStatus.PUBLISHED,
          isPublic: true,
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

  console.log(`
[seed:pub-projects-b2] 完成：新建 ${created}，跳过 ${skipped}，失败 ${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

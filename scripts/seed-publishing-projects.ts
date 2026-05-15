/**
 * 出版行业 AI 工具基础项目库种子脚本
 *
 * 批量写入出版行业 AI 工具项目，可重复执行（slug 已存在则跳过）。
 *
 * 运行：
 *   pnpm seed:pub-projects
 *
 * 需要环境变量：DATABASE_URL
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

const PUBLISHING_PROJECTS: ProjectDef[] = [
  // ─────────────────────────────────────────
  // 内容创作辅助
  // ─────────────────────────────────────────
  {
    slug: "pub-kimi",
    name: "Kimi",
    tagline: "月之暗面超长上下文 AI，支持 200 万 token 长文本处理",
    description:
      "月之暗面（Moonshot AI）推出的大语言模型产品，以超长上下文窗口（200 万 token）著称，特别适合出版编辑处理长篇稿件、跨文档逻辑推理、文献梳理与摘要生成。支持上传 PDF、Word 等文档直接分析。",
    websiteUrl: "https://kimi.moonshot.cn",
    tags: ["写作辅助", "编辑校对", "长文本处理"],
    isChineseTool: true,
  },
  {
    slug: "pub-wenxin-yiyan",
    name: "文心一言",
    tagline: "百度文心大模型，覆盖内容创作全流程",
    description:
      "百度推出的文心大语言模型产品（ERNIE Bot），支持长文档处理、多语种翻译、选题策划、稿件写作辅助等出版场景。基础功能免费，提供 API 接入能力，多家出版社已用于编辑辅助与内容初审。",
    websiteUrl: "https://yiyan.baidu.com",
    tags: ["写作辅助", "选题策划", "翻译"],
    isChineseTool: true,
  },
  {
    slug: "pub-doubao",
    name: "豆包",
    tagline: "字节跳动 AI 助手，出版内容创作与改写利器",
    description:
      "字节跳动旗下 AI 对话产品，集成豆包大模型，支持长文改写、摘要生成、营销文案撰写、多版本内容生成等功能，适用于出版社内容团队日常辅助创作与发行文案撰写。",
    websiteUrl: "https://www.doubao.com",
    tags: ["写作辅助", "营销文案"],
    isChineseTool: true,
  },
  {
    slug: "pub-tongyi-qianwen",
    name: "通义千问",
    tagline: "阿里云大模型，企业级出版内容生产接入",
    description:
      "阿里云推出的通义大语言模型，提供对话、文档处理、知识问答等能力，支持 API 私有化部署，适合出版集团级别的内容生产系统集成，支持长文本分析与多语种内容生成。",
    websiteUrl: "https://tongyi.aliyun.com",
    tags: ["写作辅助", "内容审核"],
    isChineseTool: true,
  },
  {
    slug: "pub-xiezuocat",
    name: "秘塔写作猫",
    tagline: "专为中文创作设计的 AI 写作辅助与校对工具",
    description:
      "秘塔科技推出的中文 AI 写作辅助平台，提供智能校对、句子改写、文风调整、多版本对比等功能，原生适配中文出版编辑流程。被多家出版社编辑用于稿件润色与校对提效，效率提升可达 30%-40%。",
    websiteUrl: "https://xiezuocat.com",
    tags: ["写作辅助", "编辑校对", "智能校对"],
    isChineseTool: true,
  },
  {
    slug: "pub-xinghuo-xfyun",
    name: "讯飞星火",
    tagline: "科大讯飞 AI 平台，中文语音与文本出版场景全覆盖",
    description:
      "科大讯飞推出的大模型产品，在中文语音识别、文字转语音、文档审核等领域有深厚积累。出版行业应用包括：有声书 TTS 生成、会议纪要转文稿、编辑录音转写、稿件审读辅助等。",
    websiteUrl: "https://xinghuo.xfyun.cn",
    tags: ["有声书生成", "写作辅助", "编辑校对"],
    isChineseTool: true,
  },
  {
    slug: "pub-deepseek",
    name: "DeepSeek",
    tagline: "深度求索大模型，长文本推理能力出众",
    description:
      "深度求索推出的开源大语言模型，以强大的长文本推理与代码生成能力著称，在出版领域可用于学术稿件分析、文献综述生成、选题策略推理等高难度任务。API 价格极具竞争力，适合出版机构批量接入。",
    websiteUrl: "https://www.deepseek.com",
    githubUrl: "https://github.com/deepseek-ai/DeepSeek-V3",
    tags: ["写作辅助", "选题策划", "编辑校对"],
    isChineseTool: true,
  },
  {
    slug: "pub-grammarly",
    name: "Grammarly",
    tagline: "全球领先的 AI 英文写作助手与出版校对工具",
    description:
      "面向专业写作的 AI 助手，提供语法校对、风格建议、抄袭检测等功能，Business 版本支持团队协作与品牌语气一致性管理。广泛应用于国际学术出版、英文教材编辑、企业出版物校对场景。",
    websiteUrl: "https://www.grammarly.com",
    tags: ["编辑校对", "写作辅助"],
    isChineseTool: false,
  },
  {
    slug: "pub-prowritingaid",
    name: "ProWritingAid",
    tagline: "专业作家与编辑的深度 AI 写作分析工具",
    description:
      "为出版行业专业用户设计的 AI 写作辅助工具，提供 20+ 维度的文本分析报告（节奏、重复词、过度解释等），并深度集成 Scrivener、Word 等主流写作软件，适合专业编辑对稿件进行深度审查与质量提升。",
    websiteUrl: "https://prowritingaid.com",
    tags: ["编辑校对", "写作辅助"],
    isChineseTool: false,
  },
  {
    slug: "pub-deepl",
    name: "DeepL",
    tagline: "出版级精准 AI 翻译，支持专业术语定制",
    description:
      "欧洲领先的 AI 神经网络翻译服务，以超越 Google 翻译的翻译质量著称，支持自定义术语表（Glossary）以保持出版领域专有名词一致性。Pro 版本支持 Word/PDF 文档整体翻译，适合版权引进图书的翻译辅助。",
    websiteUrl: "https://www.deepl.com",
    tags: ["翻译"],
    isChineseTool: false,
  },
  {
    slug: "pub-claude-ai",
    name: "Claude",
    tagline: "Anthropic 出品的 AI 助手，擅长长文本分析与编辑",
    description:
      "Anthropic 推出的大语言模型产品，以长文本理解、指令遵循精准度和安全性著称。出版场景应用包括：长篇书稿摘要、选题策划报告撰写、读者书评分析、营销文案生成、多语种内容改写等。",
    websiteUrl: "https://claude.ai",
    tags: ["写作辅助", "编辑校对", "选题策划"],
    isChineseTool: false,
  },

  // ─────────────────────────────────────────
  // 有声书 / 新形态出版
  // ─────────────────────────────────────────
  {
    slug: "pub-elevenlabs",
    name: "ElevenLabs",
    tagline: "全球顶尖 AI 语音生成平台，有声书制作首选",
    description:
      "ElevenLabs 提供超真实感 AI 语音合成，支持 5000+ 声音、70+ 语言，以及声音克隆（Voice Cloning）功能。出版行业用于：有声书快速量产、多角色有声故事制作、播客配音、版权图书音频化。ElevenReader 功能可一键将书稿发布为有声内容。",
    websiteUrl: "https://elevenlabs.io",
    tags: ["有声书生成", "数字人主播"],
    isChineseTool: false,
  },
  {
    slug: "pub-murf-ai",
    name: "Murf AI",
    tagline: "专业级 AI 配音工具，出版有声内容制作平台",
    description:
      "面向专业制作团队的 AI 语音平台，提供 200+ 声音、20+ 语种，支持对语速、语调、情感的精细控制，适合制作教材有声版、培训音频、有声书等专业出版音频内容。提供团队协作功能与 API 接入。",
    websiteUrl: "https://murf.ai",
    tags: ["有声书生成"],
    isChineseTool: false,
  },
  {
    slug: "pub-jianying",
    name: "剪映专业版",
    tagline: "字节跳动 AI 视频剪辑，出版新媒体传播利器",
    description:
      "字节跳动旗下视频剪辑工具，集成 AI 语音合成、数字人主播、字幕自动生成、智能剪辑等功能。出版行业应用场景：新书短视频物料制作、数字人出版营销视频、有声内容配套视频制作、抖音快手营销素材批量生产。",
    websiteUrl: "https://www.capcut.cn",
    tags: ["数字人主播", "营销文案", "新媒体运营"],
    isChineseTool: true,
  },

  // ─────────────────────────────────────────
  // 版权与资产管理
  // ─────────────────────────────────────────
  {
    slug: "pub-copytrack",
    name: "Copytrack",
    tagline: "全球图片版权追踪与侵权执法 AI 平台",
    description:
      "基于 AI 图像识别的全球版权执法服务，帮助出版商和摄影师在全网自动发现图片被侵权使用的情况，并提供法律支持追回授权费用。适合拥有大量图片版权资产的出版机构进行版权资产保护。",
    websiteUrl: "https://www.copytrack.com",
    tags: ["版权管理", "数字资产管理"],
    isChineseTool: false,
  },
  {
    slug: "pub-abbyy-finereader",
    name: "ABBYY FineReader",
    tagline: "出版档案 OCR 数字化与 PDF 智能处理平台",
    description:
      "ABBYY 旗下旗舰 OCR 与文档转换产品，支持 190+ 语种文字识别，精准还原图书、档案、期刊的版式结构。出版行业应用：历史档案数字化、绝版图书重排、合同文件提取、元数据自动生成等。",
    websiteUrl: "https://www.abbyy.com/finereader/",
    tags: ["档案数字化", "元数据处理"],
    isChineseTool: false,
  },
  {
    slug: "pub-cnki-proofread",
    name: "知网智能审校",
    tagline: "依托知网大数据的学术出版 AI 智能审校系统",
    description:
      "同方知网推出的智能审校系统，依托知网海量数据资源与 AI 大模型技术，提供问题识别、内容比对、编校检查、AIGC 检测等功能，专为学术期刊、教材、学术图书的编校环节设计，可显著降低错漏率。",
    websiteUrl: "https://www.cnki.net",
    tags: ["智能校对", "内容审核", "编辑校对"],
    isChineseTool: true,
  },

  // ─────────────────────────────────────────
  // 发行与营销
  // ─────────────────────────────────────────
  {
    slug: "pub-bookfunnel",
    name: "BookFunnel",
    tagline: "数字图书发行与读者增长 AI 平台",
    description:
      "专为作者和出版商设计的数字图书发行工具，支持 ARC（预发行书评本）分发、邮件列表构建、读者数据分析与精准营销活动组织。集成 AI 辅助撰写推荐语与读者定向推送功能，适合独立出版与中小出版社发行运营。",
    websiteUrl: "https://bookfunnel.com",
    tags: ["发行分销", "读者数据分析"],
    isChineseTool: false,
  },
  {
    slug: "pub-midjourney",
    name: "Midjourney",
    tagline: "顶尖 AI 图像生成，出版封面与插图设计首选",
    description:
      "目前商业效果最佳的 AI 图像生成工具，通过 Discord 交互或网页界面生成高质量艺术图像。出版行业广泛用于：图书封面概念设计、插图风格探索、营销海报视觉、电子书封面快速迭代，大幅降低设计成本与周期。",
    websiteUrl: "https://www.midjourney.com",
    tags: ["封面设计"],
    isChineseTool: false,
  },

  // ─────────────────────────────────────────
  // 出版流程工具
  // ─────────────────────────────────────────
  {
    slug: "pub-reedsy",
    name: "Reedsy",
    tagline: "作者与出版商一站式协作平台，含 AI 写作与排版",
    description:
      "连接作者、编辑、设计师的出版行业专业平台，提供书稿写作（Reedsy Studio）、智能排版（Book Editor）、专业人才市场等功能。AI 功能包括写作辅助、稿件格式化，适合独立作者及小型出版机构的完整出版流程管理。",
    websiteUrl: "https://reedsy.com",
    tags: ["出版流程管理", "写作辅助"],
    isChineseTool: false,
  },
  {
    slug: "pub-atticus",
    name: "Atticus",
    tagline: "图书写作与排版一体化 AI 工具",
    description:
      "将书稿写作、编辑与电子书/印刷版排版整合为一体的平台，支持输出 EPUB、PDF 等出版标准格式。内置 AI 写作辅助功能，适合出版流程数字化改造，让编辑团队从 Word + InDesign 的割裂工作流中解放出来。",
    websiteUrl: "https://www.atticus.io",
    tags: ["出版流程管理", "写作辅助"],
    isChineseTool: false,
  },
  {
    slug: "pub-scrivener",
    name: "Scrivener",
    tagline: "专业长文本写作管理软件，出版行业标准工具",
    description:
      "Literature & Latte 出品的专业书稿写作软件，以强大的长文本结构管理（大纲卡片、软木板、场景分割）著称，是国际出版作者和专业编辑处理大型书稿的行业标准工具，近年来集成 AI 写作辅助插件生态。",
    websiteUrl: "https://www.literatureandlatte.com/scrivener/overview",
    tags: ["写作辅助", "出版流程管理"],
    isChineseTool: false,
  },
  {
    slug: "pub-shuangchuan-group",
    name: "数传集团",
    tagline: "专注出版行业的 AIGC 整体技术服务商",
    description:
      "国内专注服务出版行业的 AIGC 综合技术服务商，提供智能内容生产、数字出版平台、AI 审校系统、数据资产管理等整体解决方案，客户覆盖多家国内头部出版集团，是出版数字化转型的系统集成服务提供商。",
    websiteUrl: "https://www.dcrays.cn",
    tags: ["出版流程管理", "数字出版平台", "内容审核"],
    isChineseTool: true,
  },
];

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[seed:pub-projects] 未设置 DATABASE_URL");
    process.exit(1);
  }

  console.log(`[seed:pub-projects] 开始写入 ${PUBLISHING_PROJECTS.length} 个出版 AI 工具项目…\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of PUBLISHING_PROJECTS) {
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

  console.log(`\n[seed:pub-projects] 完成：新建 ${created}，跳过 ${skipped}，失败 ${failed}`);
  console.log(`[seed:pub-projects] 所有项目均已设为 PUBLISHED，category=publishing_media`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

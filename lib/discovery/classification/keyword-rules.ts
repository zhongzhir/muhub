/**
 * 规则分类 V1：关键词 → 主类型（单选）与可选标签。
 * 仅小写匹配：调用方应提供已 lowerCase 的 haystack。
 */

export const PRIMARY_TYPE_ORDER = [
  "AI Agent",
  "Workflow Tool",
  "RAG Tool",
  "DevTool",
  "Model / Infra",
  "Media AI",
  "General AI Tool",
] as const;

export type PrimaryClassificationType = (typeof PRIMARY_TYPE_ORDER)[number];

export type KeywordRuleDef = {
  type: PrimaryClassificationType;
  /** 累加到该类型的权重 */
  weight: number;
  /** haystack 子串（小写） */
  patterns: string[];
  /** 命中时建议附加的标签（可读短名） */
  tag?: string;
};

/** 主类型偏好顺序（同分取靠前） */
export function primaryTypeRank(t: string): number {
  const i = PRIMARY_TYPE_ORDER.indexOf(t as PrimaryClassificationType);
  return i === -1 ? 999 : i;
}

export const KEYWORD_RULES: KeywordRuleDef[] = [
  {
    type: "AI Agent",
    weight: 4,
    patterns: [
      "multi-agent",
      "multi agent",
      "ai agent",
      "autonomous agent",
      "agent framework",
      "agentic",
      "crewai",
      "langgraph",
      " autogen",
      "agent swarm",
      " autonomous ",
    ],
    tag: "Agent",
  },
  {
    type: "AI Agent",
    weight: 3,
    patterns: [
      " langchain",
      "llamaindex",
      " ai crew",
      "planner-executor",
      "tool use",
      "function calling",
    ],
    tag: "Agent",
  },
  {
    type: "Workflow Tool",
    weight: 4,
    patterns: [
      "workflow",
      "automation",
      "pipeline",
      "orchestrat",
      "n8n",
      "zapier",
      "make.com",
      "ifttt",
      "cron job",
      "etl",
    ],
    tag: "Automation",
  },
  {
    type: "RAG Tool",
    weight: 4,
    patterns: [
      "retrieval augmented",
      "retrieval-augmented",
      " vector database",
      "vector db",
      "embedding",
      "semantic search",
      "chunking",
      "document q",
      " knowledge base",
    ],
    tag: "RAG",
  },
  {
    type: "RAG Tool",
    weight: 3,
    patterns: [" pinecone", " weaviate", " chroma", "qdrant", "milvus", "llamaindex rag"],
    tag: "RAG",
  },
  {
    type: "DevTool",
    weight: 4,
    patterns: [
      "coding assistant",
      "code completion",
      "copilot",
      "developer tool",
      "ide plugin",
      "linter",
      "static analysis",
      "github action",
      "ci/cd",
      "devops",
    ],
    tag: "Coding",
  },
  {
    type: "DevTool",
    weight: 3,
    patterns: [
      "code gen",
      "code generation",
      "programming",
      "software development",
      "refactor",
      "unit test",
    ],
    tag: "Dev",
  },
  {
    type: "Model / Infra",
    weight: 4,
    patterns: [
      "fine-tun",
      "finetun",
      "checkpoint",
      "llm inference",
      "model serving",
      "vllm",
      "tensorrt",
      "onnx",
      "gpu cluster",
      "training run",
      " diffusion model",
    ],
    tag: "Model",
  },
  {
    type: "Model / Infra",
    weight: 3,
    patterns: [
      "transformer",
      "foundation model",
      "base model",
      "huggingface",
      " safetensors",
      "lora",
      "qlora",
    ],
    tag: "ML Infra",
  },
  {
    type: "Media AI",
    weight: 4,
    patterns: [
      "image generation",
      "text-to-image",
      "text to image",
      "stable diffusion",
      "midjourney",
      "dall-e",
      "video generation",
      "text-to-video",
      "speech synthesis",
      "voice clone",
      "tts",
      "text-to-speech",
      "audio model",
    ],
    tag: "Media",
  },
  {
    type: "Media AI",
    weight: 3,
    patterns: ["image model", "vision model", "multimodal", "whisper", "speech-to-text"],
    tag: "Media",
  },
];


// ─────────────────────────────────────────────────────────────
// 出版行业场景标签体系 V1
// 五大场景域 + 21 个细分标签，供 AI enrichment 与广场筛选使用
// ─────────────────────────────────────────────────────────────

/**
 * 出版行业应用场景标签（完整列表）
 * 场景域 → 子标签
 */
export const PUBLISHING_SCENE_TAGS = {
  /** 内容生产端 */
  content_production: [
    "选题策划",
    "写作辅助",
    "编辑校对",
    "翻译",
    "图片生成",
    "排版设计",
  ],
  /** 内容管理端 */
  content_management: [
    "版权管理",
    "元数据处理",
    "内容审核",
    "档案数字化",
  ],
  /** 发行营销端 */
  distribution_marketing: [
    "个性化推荐",
    "营销文案",
    "读者分析",
    "社交媒体运营",
  ],
  /** 新形态出版 */
  new_publishing_forms: [
    "有声书生成",
    "交互式内容",
    "数字人主播",
    "知识图谱",
  ],
  /** 运营管理端 */
  operations: [
    "合同处理",
    "数据分析",
    "客服自动化",
  ],
} as const;

export type PublishingSceneDomain = keyof typeof PUBLISHING_SCENE_TAGS;
export type PublishingSceneTag =
  (typeof PUBLISHING_SCENE_TAGS)[PublishingSceneDomain][number];

/** 所有出版场景标签扁平列表（供 AI prompt 和筛选使用） */
export const ALL_PUBLISHING_SCENE_TAGS: readonly string[] = [
  ...(PUBLISHING_SCENE_TAGS.content_production as readonly string[]),
  ...(PUBLISHING_SCENE_TAGS.content_management as readonly string[]),
  ...(PUBLISHING_SCENE_TAGS.distribution_marketing as readonly string[]),
  ...(PUBLISHING_SCENE_TAGS.new_publishing_forms as readonly string[]),
  ...(PUBLISHING_SCENE_TAGS.operations as readonly string[]),
];

/**
 * 出版行业关键词映射 → 场景标签
 * 用于规则层快速匹配（补充 AI enrichment 的精确分析）
 */
export const PUBLISHING_KEYWORD_TO_TAGS: Array<{
  patterns: string[];
  tags: string[];
}> = [
  // 内容生产端
  {
    patterns: ["writing assistant", "ai writing", "content generation", "ai writer", "copywriting",
               "写作助手", "ai写作", "文案生成", "内容生成"],
    tags: ["写作辅助"],
  },
  {
    patterns: ["proofreading", "grammar check", "spell check", "editing tool",
               "校对", "审校", "纠错", "编辑工具"],
    tags: ["编辑校对"],
  },
  {
    patterns: ["translation", "translate", "localization", "i18n", "multilingual",
               "翻译", "本地化", "多语言"],
    tags: ["翻译"],
  },
  {
    patterns: ["image generation", "text-to-image", "illustration",
               "图片生成", "图像生成", "插图"],
    tags: ["图片生成"],
  },
  {
    patterns: ["typesetting", "layout", "desktop publishing", "indesign",
               "排版", "版式", "书籍设计"],
    tags: ["排版设计"],
  },
  {
    patterns: ["topic discovery", "content strategy", "editorial planning",
               "选题", "策划", "内容策略"],
    tags: ["选题策划"],
  },
  // 内容管理端
  {
    patterns: ["copyright", "rights management", "drm", "license",
               "版权", "著作权", "版权管理"],
    tags: ["版权管理"],
  },
  {
    patterns: ["metadata", "isbn", "catalog", "bibliographic",
               "元数据", "书目", "图书馆"],
    tags: ["元数据处理"],
  },
  {
    patterns: ["content moderation", "content review",
               "审核", "内容审核", "过滤"],
    tags: ["内容审核"],
  },
  {
    patterns: ["digitization", "ocr", "scan", "archive", "digital preservation",
               "数字化", "扫描", "档案", "ocr识别"],
    tags: ["档案数字化"],
  },
  // 发行营销端
  {
    patterns: ["recommendation engine", "personalization", "reader recommendation",
               "书单推荐", "个性化推荐", "智能推荐"],
    tags: ["个性化推荐"],
  },
  {
    patterns: ["book marketing", "publishing marketing", "author marketing",
               "图书营销", "营销", "推广文案"],
    tags: ["营销文案"],
  },
  {
    patterns: ["reader analytics", "reading behavior", "audience insight",
               "读者分析", "用户行为", "阅读数据"],
    tags: ["读者分析"],
  },
  {
    patterns: ["social media", "social publishing", "content distribution",
               "社交媒体", "全渠道", "内容分发"],
    tags: ["社交媒体运营"],
  },
  // 新形态出版
  {
    patterns: ["audiobook", "text-to-speech", "tts", "voice narration",
               "有声书", "有声读物", "语音合成"],
    tags: ["有声书生成"],
  },
  {
    patterns: ["interactive book", "interactive content", "enhanced ebook",
               "交互", "互动内容", "互动出版"],
    tags: ["交互式内容"],
  },
  {
    patterns: ["digital avatar", "virtual anchor", "ai presenter",
               "数字人", "虚拟主播", "ai主播"],
    tags: ["数字人主播"],
  },
  {
    patterns: ["knowledge graph", "ontology", "semantic",
               "知识图谱", "知识库", "语义网络"],
    tags: ["知识图谱"],
  },
  // 运营管理端
  {
    patterns: ["contract management", "rights contract", "publishing agreement",
               "合同", "版权合同", "协议管理"],
    tags: ["合同处理"],
  },
  {
    patterns: ["data analytics", "business intelligence", "dashboard",
               "数据分析", "商业智能", "数据报告"],
    tags: ["数据分析"],
  },
  {
    patterns: ["customer service", "chatbot", "support automation",
               "客服", "智能客服", "客户服务"],
    tags: ["客服自动化"],
  },
];

/** 弱 AI 语境词：用于 isAiRelated / General 兜底前的信号 */
export const GENERIC_AI_HINT_PATTERNS = [
  "llm",
  "gpt",
  "openai",
  "anthropic",
  "claude",
  "gemini",
  "machine learning",
  "deep learning",
  "neural",
  "artificial intelligence",
  "generative ai",
  "大模型",
  "机器学习",
  "深度学习",
  "人工智能",
  "语言模型",
  "提示工程",
  "prompt engineering",
];

/** 华语/国内产品辅助属性（不含公众号爬取，仅文本规则） */
export const CHINESE_TOOL_PATTERNS = [
  "中文",
  "国内",
  "中国大陆",
  "华语",
  "汉语",
  "简体",
  "繁体",
  "中文版",
  "国产",
  "微信",
  "腾讯",
  "阿里",
  "字节",
  "百度",
  "知乎",
  "bilibili",
  "哔哩",
];

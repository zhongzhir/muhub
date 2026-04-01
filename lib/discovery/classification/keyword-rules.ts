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

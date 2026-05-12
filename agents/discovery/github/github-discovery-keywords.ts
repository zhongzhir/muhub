export const GITHUB_DISCOVERY_KEYWORDS = [
  // Agent
  "ai agent",
  "agent framework",
  "multi agent",
  "autonomous agent",
  "agent orchestration",
  "agent automation",
  "ai agent platform",

  // LLM / RAG
  "llm",
  "rag",
  "prompt engineering",
  "embedding",
  "vector database",
  "llmops",
  "retrieval augmented generation",

  // AI Tools
  "workflow automation",
  "copilot",
  "assistant",
  "ai tool",
  "ai app",
  "ai platform",
  "ai developer tool",
  "ai productivity",
  "open source copilot",

  // Ecosystem / Framework
  "open source ai",
  "ai framework",
  "langchain",
  "llamaindex",
  "langgraph",
  "crewai",
  "autogen",
  "mcp server",
  "model context protocol",

  // 中国 / 中文 AI 项目——优先发现国产开源项目
  // （GitHub 搜索 API 支持中文关键词，以下词条覆盖常见国产表述）
  "国产大模型",
  "国产 AI",
  "中文大模型",
  "中文 AI",
  "中文 agent",
  "中文 llm",
  "AI 助手 中文",
  "开源 大模型",
  "开源大模型",
  "中文 RAG",
  "大语言模型",
  "智能体 开源",
] as const;

export type GitHubDiscoveryKeyword = (typeof GITHUB_DISCOVERY_KEYWORDS)[number];

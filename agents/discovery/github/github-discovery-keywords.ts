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
] as const;

export type GitHubDiscoveryKeyword = (typeof GITHUB_DISCOVERY_KEYWORDS)[number];

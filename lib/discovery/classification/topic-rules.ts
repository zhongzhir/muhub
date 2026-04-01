/**
 * GitHub topics（小写/连字符）→ 展示用标签 + 可选主类型加权
 */

export type TopicRule = {
  tag: string;
  /** 给主类型加分（与 keyword 权重同量级） */
  typeBoost?: string;
  evidence: string;
};

/** topic 名归一：小写、下划线改连字符 */
export function normalizeGithubTopic(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, "-");
}

const TOPIC_MAP: Record<string, TopicRule> = {
  llm: { tag: "LLM", typeBoost: "Model / Infra", evidence: "matched topic: llm" },
  rag: { tag: "RAG", typeBoost: "RAG Tool", evidence: "matched topic: rag" },
  agent: { tag: "Agent", typeBoost: "AI Agent", evidence: "matched topic: agent" },
  agents: { tag: "Agent", typeBoost: "AI Agent", evidence: "matched topic: agents" },
  workflow: { tag: "Workflow", typeBoost: "Workflow Tool", evidence: "matched topic: workflow" },
  workflows: { tag: "Workflow", typeBoost: "Workflow Tool", evidence: "matched topic: workflows" },
  ai: { tag: "AI", evidence: "matched topic: ai" },
  ml: { tag: "Machine Learning", typeBoost: "Model / Infra", evidence: "matched topic: ml" },
  "machine-learning": {
    tag: "Machine Learning",
    typeBoost: "Model / Infra",
    evidence: "matched topic: machine-learning",
  },
  "open-source": { tag: "Open Source", evidence: "matched topic: open-source" },
  automation: {
    tag: "Automation",
    typeBoost: "Workflow Tool",
    evidence: "matched topic: automation",
  },
  nlp: { tag: "NLP", typeBoost: "Model / Infra", evidence: "matched topic: nlp" },
  voice: { tag: "Voice", typeBoost: "Media AI", evidence: "matched topic: voice" },
  video: { tag: "Video", typeBoost: "Media AI", evidence: "matched topic: video" },
  audio: { tag: "Audio", typeBoost: "Media AI", evidence: "matched topic: audio" },
  "image-generation": {
    tag: "Image Gen",
    typeBoost: "Media AI",
    evidence: "matched topic: image-generation",
  },
  "coding-assistant": {
    tag: "Coding Assistant",
    typeBoost: "DevTool",
    evidence: "matched topic: coding-assistant",
  },
  copilot: { tag: "Copilot", typeBoost: "DevTool", evidence: "matched topic: copilot" },
  pytorch: { tag: "PyTorch", typeBoost: "Model / Infra", evidence: "matched topic: pytorch" },
  tensorflow: { tag: "TensorFlow", typeBoost: "Model / Infra", evidence: "matched topic: tensorflow" },
  langchain: { tag: "LangChain", typeBoost: "AI Agent", evidence: "matched topic: langchain" },
  langgraph: { tag: "LangGraph", typeBoost: "AI Agent", evidence: "matched topic: langgraph" },
  llamaindex: { tag: "LlamaIndex", typeBoost: "RAG Tool", evidence: "matched topic: llamaindex" },
  vector: { tag: "Vector", typeBoost: "RAG Tool", evidence: "matched topic: vector" },
  embedding: { tag: "Embeddings", typeBoost: "RAG Tool", evidence: "matched topic: embedding" },
  mcp: { tag: "MCP", typeBoost: "DevTool", evidence: "matched topic: mcp" },
  cli: { tag: "CLI", typeBoost: "DevTool", evidence: "matched topic: cli" },
};

export function applyTopicRules(topics: string[]): {
  tags: string[];
  typeWeights: Record<string, number>;
  evidence: string[];
} {
  const tags: string[] = [];
  const typeWeights: Record<string, number> = {};
  const evidence: string[] = [];
  const seenTag = new Set<string>();

  for (const raw of topics) {
    const k = normalizeGithubTopic(raw);
    if (!k) {
      continue;
    }
    const rule = TOPIC_MAP[k];
    if (!rule) {
      continue;
    }
    const tk = rule.tag.toLowerCase();
    if (seenTag.has(tk)) {
      continue;
    }
    seenTag.add(tk);
    tags.push(rule.tag);
    evidence.push(rule.evidence);
    if (rule.typeBoost) {
      typeWeights[rule.typeBoost] = (typeWeights[rule.typeBoost] ?? 0) + 4;
    }
  }

  return { tags, typeWeights, evidence };
}

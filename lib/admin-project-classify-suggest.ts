import type { ProjectCategory } from "@/lib/projects/project-categories";
import { PROJECT_CATEGORIES } from "@/lib/projects/project-categories";

/** 运营编辑页「自动生成」用的输入（按优先级拼接文本信号） */
export type AdminClassifySuggestInput = {
  githubUrl: string;
  tagline: string;
  description: string;
  name: string;
  websiteUrl: string;
  /** README 不可得时的摘要代理（动态摘要等） */
  aiCardSummary: string;
};

export type AdminClassifySuggestResult = {
  primaryCategory: ProjectCategory;
  /** 1~5 条，逗号分隔即可被 parseProjectTags 消费 */
  tags: string[];
};

const CATEGORY_RULES: Array<{ cat: ProjectCategory; patterns: RegExp[]; weight: number }> = [
  {
    cat: "ai-agents",
    weight: 5,
    patterns: [
      /\b(agent|agents|agentic|multi-agent|multiagent|langchain|langgraph|crewai|autogen|swarm)\b/i,
      /\b(mcp\b|model context protocol)/i,
      /\b(chatbot|copilot|assistant)\b/i,
      /\b(自主|智能体|代理)\b/,
    ],
  },
  {
    cat: "datasets",
    weight: 4,
    patterns: [
      /\b(dataset|datasets|benchmark|benchmarks|corpus|embedding|vector db|vector database|rag\b)\b/i,
      /\b(pinecone|weaviate|chroma|qdrant|milvus)\b/i,
      /\b(数据集|向量|检索)\b/,
    ],
  },
  {
    cat: "infra",
    weight: 4,
    patterns: [
      /\b(infra|infrastructure|kubernetes|k8s|docker|deploy|deployment|gpu|inference server|vllm|onnx)\b/i,
      /\b(ci\/cd|devops|terraform|helm)\b/i,
      /\b(推理|部署|运维)\b/,
    ],
  },
  {
    cat: "developer-tools",
    weight: 4,
    patterns: [
      /\b(devtool|dev tool|developer tool|sdk|cli|vscode|jetbrains|linter|formatter|npm package|library)\b/i,
      /\b(github action|ci plugin|ide extension)\b/i,
      /\b(开发者|脚手架|插件|工具链)\b/,
    ],
  },
  {
    cat: "research",
    weight: 3,
    patterns: [
      /\b(research|arxiv|paper|publication|experiment|ablation|sota)\b/i,
      /\b(论文|实验|研究)\b/,
    ],
  },
  {
    cat: "open-source",
    weight: 3,
    patterns: [/\b(open source|opensource|oss|apache-2|mit license|gpl)\b/i, /\b(开源)\b/],
  },
  {
    cat: "design",
    weight: 3,
    patterns: [/\b(figma|sketch|ui kit|design system|prototype)\b/i, /\b(设计|界面|原型)\b/],
  },
  {
    cat: "productivity",
    weight: 3,
    patterns: [/\b(workflow|automation|notion|calendar|crm|zapier|n8n)\b/i, /\b(效率|工作流|自动化)\b/],
  },
];

const TAG_SIGNALS: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "GitHub", pattern: /github\.com/i },
  { tag: "开源项目", pattern: /\b(open source|opensource|oss|开源)\b/i },
  { tag: "AI", pattern: /\b(ai|llm|gpt|claude|gemini|machine learning|ml\b|大模型|人工智能)\b/i },
  { tag: "Agent", pattern: /\b(agent|agents|agentic|智能体)\b/i },
  { tag: "Infra", pattern: /\b(infra|kubernetes|docker|deploy|gpu|推理)\b/i },
  { tag: "DevTool", pattern: /\b(devtool|sdk|cli|developer|开发者工具)\b/i },
  { tag: "RAG", pattern: /\b(rag|retrieval|embedding|vector)\b/i },
  { tag: "MCP", pattern: /\bmcp\b|model context protocol/i },
];

function buildHaystack(input: AdminClassifySuggestInput): string {
  const gh = input.githubUrl.trim();
  const ghExtra = extractGithubHaystack(gh);
  const ordered = [
    gh,
    ghExtra,
    input.tagline,
    input.description,
    input.name,
    input.websiteUrl,
    input.aiCardSummary,
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  return ordered.join("\n").toLowerCase();
}

function extractGithubHaystack(url: string): string {
  if (!url) {
    return "";
  }
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().includes("github")) {
      return "";
    }
    const segs = u.pathname.split("/").filter(Boolean);
    if (segs.length >= 2) {
      return `${segs[0]} ${segs[1]}`.replace(/[-_]/g, " ");
    }
  } catch {
    return "";
  }
  return "";
}

function scoreCategories(hay: string): Map<ProjectCategory, number> {
  const scores = new Map<ProjectCategory, number>();
  for (const c of PROJECT_CATEGORIES) {
    scores.set(c, 0);
  }
  for (const rule of CATEGORY_RULES) {
    for (const re of rule.patterns) {
      re.lastIndex = 0;
      if (re.test(hay)) {
        scores.set(rule.cat, (scores.get(rule.cat) ?? 0) + rule.weight);
      }
    }
  }
  return scores;
}

function pickCategory(scores: Map<ProjectCategory, number>): ProjectCategory {
  let best: ProjectCategory = "other";
  let bestScore = -1;
  for (const c of PROJECT_CATEGORIES) {
    const s = scores.get(c) ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  /** 无任何规则命中时不得落在「首个枚举」上，应明确为 other */
  return bestScore > 0 ? best : "other";
}

function collectTags(hay: string, originalHay: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (t: string) => {
    const k = t.trim();
    if (!k || seen.has(k.toLowerCase())) {
      return;
    }
    seen.add(k.toLowerCase());
    out.push(k);
  };

  for (const { tag, pattern } of TAG_SIGNALS) {
    pattern.lastIndex = 0;
    if (pattern.test(originalHay) || pattern.test(hay)) {
      add(tag);
    }
  }

  if (/\b(langchain|langgraph)\b/i.test(originalHay)) {
    add("LangChain");
  }
  if (/\bdataset\b/i.test(hay)) {
    add("Dataset");
  }
  if (/\btypescript\b/i.test(hay)) {
    add("TypeScript");
  }
  if (/\brust\b/i.test(hay)) {
    add("Rust");
  }
  if (/\bpython\b/i.test(hay)) {
    add("Python");
  }

  while (out.length > 5) {
    out.pop();
  }
  if (out.length === 0) {
    add("AI");
  }
  return out.slice(0, 5);
}

/**
 * 规则法：从项目文案与 GitHub 链接推断分类与 1~5 个标签（不调用外部 AI）。
 */
export function suggestAdminProjectClassificationAndTags(
  input: AdminClassifySuggestInput,
): AdminClassifySuggestResult {
  const originalHay = [
    input.githubUrl,
    input.tagline,
    input.description,
    input.name,
    input.websiteUrl,
    input.aiCardSummary,
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n");
  const hay = buildHaystack(input);
  const scores = scoreCategories(hay);
  const primaryCategory = pickCategory(scores);
  const tags = collectTags(hay, originalHay);
  return { primaryCategory, tags };
}

type SimpleSummaryInput = {
  name: string;
  tagline?: string | null;
  description?: string | null;
  primaryCategory?: string | null;
  tags?: string[];
  referenceSummaries?: string[];
};

const CATEGORY_ZH_MAP: Record<string, string> = {
  "ai-agents": "AI智能助手",
  "developer-tools": "开发工具",
  "open-source": "开源项目",
  research: "研究项目",
  infra: "基础设施",
  datasets: "数据工具",
  design: "设计工具",
  productivity: "效率工具",
  other: "创新项目",
};

const TECH_TO_SIMPLE: Record<string, string> = {
  LLM: "AI",
  llm: "AI",
  agent: "智能助手",
  agents: "智能助手",
  framework: "工具",
  orchestration: "自动协作",
  infrastructure: "系统",
  platform: "平台",
  pipeline: "流程工具",
};

function categoryToZh(raw?: string | null): string {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) {
    return "创新项目";
  }
  return CATEGORY_ZH_MAP[key] ?? "创新项目";
}

function simplifyTechTerms(text: string): string {
  let out = text;
  for (const [from, to] of Object.entries(TECH_TO_SIMPLE)) {
    out = out.replace(new RegExp(from, "gi"), to);
  }
  return out;
}

function pickFirstTwoSentences(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "";
  }
  const parts = cleaned
    .split(/(?<=[。！？!?\.])/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return cleaned;
  }
  return parts.slice(0, 2).join("");
}

function normalizeLength(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= 40) {
    return compact;
  }
  return `${compact.slice(0, 39).trim()}…`;
}

function normalizeFragmentForZh(text: string): string {
  return simplifyTechTerms(text)
    .replace(/\busers?\b/gi, "用户")
    .replace(/\bworkflow(s)?\b/gi, "工作流")
    .replace(/\bautomation\b/gi, "自动化")
    .replace(/\bdeveloper(s)?\b/gi, "开发者")
    .replace(/\bteam(s)?\b/gi, "团队")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:]+|[\s,.;:]+$/g, "")
    .trim();
}

function sentenceFromEnglishPattern(text: string): string | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!/[A-Za-z]/.test(t)) {
    return null;
  }

  let m = t.match(/^(?:an?|the)\s+(.+?)\s+for\s+(.+)$/i);
  if (m) {
    const x = normalizeFragmentForZh(m[1] ?? "");
    const y = normalizeFragmentForZh(m[2] ?? "");
    if (x && y) {
      return normalizeLength(`一个用于${y}的${x}`);
    }
  }

  m = t.match(/^(?:an?\s+)?platform\s+for\s+(.+)$/i);
  if (m) {
    const x = normalizeFragmentForZh(m[1] ?? "");
    if (x) {
      return normalizeLength(`一个帮助用户完成${x}的平台`);
    }
  }

  m = t.match(/^(?:an?\s+)?open[-\s]?source\s+tool\s+for\s+(.+)$/i);
  if (m) {
    const x = normalizeFragmentForZh(m[1] ?? "");
    if (x) {
      return normalizeLength(`一个开源工具，用来帮助用户完成${x}`);
    }
  }

  m = t.match(/^(?:an?\s+)?framework\s+for\s+(.+)$/i);
  if (m) {
    const x = normalizeFragmentForZh(m[1] ?? "");
    if (x) {
      return normalizeLength(`一个用于${x}的工具`);
    }
  }

  m = t.match(/^(.+?)\s+that\s+helps?\s+users?\s+(.+)$/i);
  if (m) {
    const x = normalizeFragmentForZh(m[1] ?? "");
    const y = normalizeFragmentForZh(m[2] ?? "");
    if (x && y) {
      return normalizeLength(`一个${x}，帮助用户${y}`);
    }
  }

  return null;
}

function toColloquial(text: string): string {
  const patternSentence = sentenceFromEnglishPattern(text);
  if (patternSentence) {
    return patternSentence;
  }
  const replaced = simplifyTechTerms(text)
    .replace(/基于/gi, "用")
    .replace(/实现/gi, "做")
    .replace(/方案/gi, "方式")
    .replace(/能力/gi, "功能")
    .replace(/体系/gi, "方法")
    .trim();
  return normalizeLength(replaced);
}

export function generateSimpleSummary(input: SimpleSummaryInput): string {
  const referenceText = (input.referenceSummaries ?? []).find((item) => item?.trim());
  if (referenceText) {
    const sentence = pickFirstTwoSentences(referenceText);
    const colloquial = toColloquial(sentence);
    if (colloquial) {
      return colloquial;
    }
  }

  const fromTaglineOrDescription = input.tagline?.trim() || input.description?.trim() || "";
  if (fromTaglineOrDescription) {
    const sentence = pickFirstTwoSentences(fromTaglineOrDescription);
    const colloquial = toColloquial(sentence);
    if (colloquial) {
      return colloquial;
    }
  }

  const categoryZh = categoryToZh(input.primaryCategory);
  return `一个面向${categoryZh}场景的项目`;
}

const TERM_MAP: Array<[RegExp, string]> = [
  [/\bopen[\s-]?source\b/gi, "开源"],
  [/\bdeveloper tools?\b/gi, "开发工具"],
  [/\bbusiness automation\b/gi, "企业自动化"],
  [/\bautomation\b/gi, "自动化"],
  [/\bworkflow\b/gi, "工作流"],
  [/\borchestration\b/gi, "编排"],
  [/\bknowledge base\b/gi, "知识库"],
  [/\bcustomer support\b/gi, "客服"],
  [/\banalytics\b/gi, "数据分析"],
  [/\bmarketing\b/gi, "营销"],
  [/\bcontent\b/gi, "内容"],
  [/\benterprise\b/gi, "企业服务"],
  [/\bproductivity\b/gi, "效率工具"],
];

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function normalizeChineseExpression(text: string): string {
  let out = collapseWhitespace(text);
  if (!out) return "";
  for (const [pattern, replacement] of TERM_MAP) {
    out = out.replace(pattern, replacement);
  }
  return collapseWhitespace(out);
}

export function normalizeChineseList(items: string[]): string[] {
  const unique = new Set<string>();
  for (const item of items) {
    const normalized = normalizeChineseExpression(item);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

const URL_PATTERN = /https?:\/\/[^\s<>"'`，。；：！？、（）【】]+/gi;
const REPO_PATTERN = /\b[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\b/g;
const BRAND_TOKEN_PATTERN =
  /\b(?:GitHub|Product Hunt|Copilot|ChatGPT|OpenAI|Midjourney|Stable Diffusion|DeepSeek|Claude|Docker|Kubernetes|PostgreSQL|MySQL|Redis|MongoDB|RAG|SaaS|API|SDK|LLM|iOS|Android|Chrome|npm|pnpm|Bifrost|MUHUB)\b/gi;

type PreserveSlot = { token: string; value: string };

function collectPreserveSlots(text: string, extraTokens: string[] = []): { text: string; slots: PreserveSlot[] } {
  const slots: PreserveSlot[] = [];
  let index = 0;
  const placeholder = (value: string) => {
    const token = `__PRESERVE_${index}__`;
    index += 1;
    slots.push({ token, value });
    return token;
  };
  let out = text;
  out = out.replace(URL_PATTERN, (match) => placeholder(match));
  out = out.replace(REPO_PATTERN, (match) => placeholder(match));
  out = out.replace(BRAND_TOKEN_PATTERN, (match) => placeholder(match));
  for (const raw of extraTokens) {
    const token = raw.trim();
    if (!token || out.includes(token)) continue;
    out = out.split(token).join(placeholder(token));
  }
  return { text: out, slots };
}

function restorePreserveSlots(text: string, slots: PreserveSlot[]): string {
  let out = text;
  for (const slot of slots) {
    out = out.replaceAll(slot.token, slot.value);
  }
  return out;
}

/** 估算文本中英文字母占比（0~1），用于判断是否需要中文化兜底。 */
export function measureEnglishLetterRatio(text: string): number {
  const cleaned = text.replace(URL_PATTERN, " ").replace(/\s+/g, " ");
  if (!cleaned.trim()) return 0;
  const latin = (cleaned.match(/[A-Za-z]/g) ?? []).length;
  const cjk = (cleaned.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const total = latin + cjk;
  if (total === 0) return latin > 0 ? 1 : 0;
  return latin / total;
}

export function isEnglishDominantProjectText(text: string, threshold = 0.42): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/[\u4e00-\u9fff]/.test(trimmed) && measureEnglishLetterRatio(trimmed) < threshold) {
    return false;
  }
  if (!/[\u4e00-\u9fff]/.test(trimmed) && /[A-Za-z]{3,}/.test(trimmed)) {
    return true;
  }
  return measureEnglishLetterRatio(trimmed) >= threshold;
}

/** 将项目文案归一化为简体中文表达，保留品牌名、repo 名、URL、技术专有名词。 */
export function sanitizeChineseProjectText(
  text: string,
  options?: { preserveTokens?: string[] },
): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const { text: masked, slots } = collectPreserveSlots(trimmed, options?.preserveTokens ?? []);
  const normalized = normalizeChineseExpression(masked);
  return restorePreserveSlots(normalized, slots);
}

export function sanitizeChineseProjectList(
  items: string[],
  options?: { preserveTokens?: string[] },
): string[] {
  const unique = new Set<string>();
  for (const item of items) {
    const normalized = sanitizeChineseProjectText(item, options);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique];
}

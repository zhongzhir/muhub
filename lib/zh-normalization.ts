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

/**
 * GitHub Repository Search API 的 `q` 拼接：仅使用支持的 qualifier，单空格连接，避免散落模板字符串。
 */

export type BuildGithubSearchQueryInput = {
  /** 单个关键词或短语（短语可含空格，会自动加引号） */
  keyword: string;
  language?: string;
  minStars?: number;
  /** YYYY-MM-DD，对应 qualifier `pushed:>` */
  pushedAfter?: string;
};

function quoteKeyword(keyword: string): string {
  const t = keyword.trim();
  if (!t) {
    return "";
  }
  if (/[\s"]/.test(t)) {
    return `"${t.replace(/"/g, '\\"')}"`;
  }
  return t;
}

/**
 * 过滤空段，用单空格 join；不添加括号或 OR。
 */
export function buildGitHubSearchQuery(task: BuildGithubSearchQueryInput): string {
  const kw = quoteKeyword(task.keyword);
  if (!kw) {
    throw new Error("buildGitHubSearchQuery: keyword is required");
  }

  const parts: string[] = [kw];

  const lang = task.language?.trim();
  if (lang) {
    parts.push(`language:${lang}`);
  }

  if (
    task.minStars != null &&
    Number.isFinite(task.minStars) &&
    task.minStars > 0
  ) {
    parts.push(`stars:>${Math.floor(task.minStars)}`);
  }

  const pushed = task.pushedAfter?.trim();
  if (pushed) {
    parts.push(`pushed:>${pushed}`);
  }

  return parts.filter(Boolean).join(" ");
}

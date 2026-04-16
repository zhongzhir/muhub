/**
 * 去重优先：规范化 GitHub 仓库 URL（忽略 query/hash、尾部斜杠、.git）。
 */
export function normalizeGithubRepoUrl(raw: string): string {
  const input = raw.trim();
  const href = /^(https?:)?\/\//i.test(input)
    ? input
    : /^(www\.)?github\.com\//i.test(input)
      ? `https://${input}`
      : input;
  const u = new URL(href);
  u.hash = "";
  u.search = "";
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "github.com") {
    throw new Error("Not a GitHub repo URL");
  }
  const segments = u.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error("Invalid GitHub repo URL");
  }
  const owner = segments[0]!;
  let repo = segments[1]!;
  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }
  if (!owner || !repo) {
    throw new Error("Invalid GitHub repo URL");
  }
  u.protocol = "https:";
  u.hostname = "github.com";
  u.pathname = `/${owner}/${repo}`;
  return u.toString();
}

export function buildGithubNormalizedKey(owner: string, repo: string): string {
  const o = owner.trim().toLowerCase();
  const r = repo.trim().toLowerCase();
  return `github:${o}/${r}`;
}

/** 用于去重：统一小写主机名并去掉常见 `www.` 前缀 */
export function normalizeWebsiteHost(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  const href = raw.trim();
  try {
    const u = new URL(href.includes("://") ? href : `https://${href}`);
    return u.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

/** 从描述等文本中提取首个 GitHub 仓库 URL（若有） */
export function firstGithubRepoUrlFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) {
    return null;
  }
  const re = /((?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/[^\s)\]}>，。；;、]*)?)/gi;
  const m = re.exec(text);
  if (!m?.[1]) {
    return null;
  }
  return normalizeGithubRepoUrlOrNull(m[1]);
}

export function normalizeGithubRepoUrlOrNull(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    return normalizeGithubRepoUrl(raw);
  } catch {
    return null;
  }
}

export function extractGithubRepoUrlsFromText(text: string | null | undefined): {
  rawMatches: string[];
  normalizedMatches: string[];
} {
  if (!text?.trim()) {
    return { rawMatches: [], normalizedMatches: [] };
  }
  const re = /((?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\/[^\s)\]}>，。；;、]*)?)/gi;
  const rawMatches = Array.from(text.matchAll(re), (match) => match[1] ?? "").filter(Boolean);
  const normalized = new Set<string>();
  for (const raw of rawMatches) {
    const next = normalizeGithubRepoUrlOrNull(raw);
    if (next) {
      normalized.add(next);
    }
  }
  return {
    rawMatches,
    normalizedMatches: Array.from(normalized),
  };
}

/**
 * 去重优先：规范化 GitHub 仓库 URL（忽略 query/hash、尾部斜杠、.git）。
 */
export function normalizeGithubRepoUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.hash = "";
  u.search = "";
  let path = u.pathname.replace(/\/+$/, "");
  if (path.endsWith(".git")) {
    path = path.slice(0, -4);
  }
  u.pathname = path;
  return u.href;
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
  const re = /https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/gi;
  const m = re.exec(text);
  if (!m?.[1] || !m[2]) {
    return null;
  }
  return `https://github.com/${m[1]}/${m[2]}`;
}

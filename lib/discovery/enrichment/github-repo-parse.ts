/** 从 GitHub 仓库 URL 解析 owner / repo（忽略 tree/blob 等后续路径）。 */
export function parseGithubOwnerRepoFromUrl(repoUrl: string): {
  owner: string;
  repo: string;
} | null {
  try {
    const u = new URL(repoUrl.trim());
    if (!u.hostname.toLowerCase().includes("github.com")) {
      return null;
    }
    const parts = u.pathname
      .replace(/^\/+/, "")
      .split("/")
      .filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    const owner = parts[0];
    let repo = parts[1];
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

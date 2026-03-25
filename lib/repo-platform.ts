/**
 * 多代码托管平台：URL 解析与比对（GitHub / Gitee，可扩展）。
 */

export type RepoPlatform = "github" | "gitee";

export type ParsedRepoUrl = {
  platform: RepoPlatform;
  owner: string;
  repo: string;
};

export function parseRepoUrl(raw: string): ParsedRepoUrl | null {
  const s = raw.trim();
  if (!s) {
    return null;
  }

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    const bareHost = host.startsWith("www.") ? host.slice(4) : host;

    let platform: RepoPlatform | null = null;
    if (bareHost === "github.com") {
      platform = "github";
    } else if (bareHost === "gitee.com") {
      platform = "gitee";
    } else {
      return null;
    }

    const segments = u.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }
    const owner = segments[0]!;
    let repo = segments[1]!;
    if (repo.endsWith(".git")) {
      repo = repo.slice(0, -4);
    }
    if (!owner || !repo) {
      return null;
    }
    return { platform, owner, repo };
  } catch {
    return null;
  }
}

/** 用于认领等场景比对是否为同一仓库（平台 + owner + repo，大小写不敏感） */
export function repoUrlsMatch(stored: string | null | undefined, input: string): boolean {
  const a = parseRepoUrl(stored ?? "");
  const b = parseRepoUrl(input);
  if (!a || !b) {
    return false;
  }
  return (
    a.platform === b.platform &&
    a.owner.toLowerCase() === b.owner.toLowerCase() &&
    a.repo.toLowerCase() === b.repo.toLowerCase()
  );
}

/** 规范化为可比较的仓库页 URL（https://github.com 或 https://gitee.com，路径小写） */
export function normalizeRepoWebUrl(raw: string): string | null {
  const p = parseRepoUrl(raw.trim());
  if (!p) {
    return null;
  }
  const host = p.platform === "github" ? "github.com" : "gitee.com";
  return `https://${host}/${p.owner.toLowerCase()}/${p.repo.toLowerCase()}`;
}

export function repoPlatformDisplayLabel(platform: RepoPlatform | undefined | null): string {
  if (platform === "gitee") {
    return "Gitee";
  }
  return "GitHub";
}

/** 根据仓库页 URL 推断链接文案（无快照字段时的回退） */
export function codeHostLinkLabel(url: string | undefined | null): string {
  const p = parseRepoUrl(url ?? "");
  return repoPlatformDisplayLabel(p?.platform);
}

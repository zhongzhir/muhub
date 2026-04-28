export type ProjectSourceType = "GITHUB" | "GITCC" | "EXTERNAL";

export type ParsedProjectSourceUrl =
  | {
      type: "GITHUB";
      url: string;
      owner: string;
      repo: string;
    }
  | {
      type: "GITCC" | "EXTERNAL";
      url: string;
      owner: null;
      repo: null;
    };

function withDefaultProtocol(raw: string): string {
  const s = raw.trim();
  if (!s) {
    return s;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    return s;
  }
  if (/^(www\.)?(github|gitcc)\.com\//i.test(s)) {
    return `https://${s}`;
  }
  return s;
}

function normalizeHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(withDefaultProtocol(raw));
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return null;
    }
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

export function detectProjectSource(url: string): ProjectSourceType | null {
  const u = normalizeHttpUrl(url);
  if (!u) {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "github.com") {
    return "GITHUB";
  }
  if (host === "gitcc.com") {
    return "GITCC";
  }
  return "EXTERNAL";
}

export function parseProjectSourceUrl(url: string): ParsedProjectSourceUrl | null {
  const u = normalizeHttpUrl(url);
  if (!u) {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segments = u.pathname.split("/").filter(Boolean);

  if (host === "github.com") {
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
    u.protocol = "https:";
    u.hostname = "github.com";
    u.search = "";
    u.pathname = `/${owner}/${repo}`;
    return { type: "GITHUB", url: u.toString(), owner, repo };
  }

  if (host === "gitcc.com") {
    if (segments.length < 1) {
      return null;
    }
    u.protocol = "https:";
    u.hostname = "www.gitcc.com";
    return { type: "GITCC", url: u.toString(), owner: null, repo: null };
  }

  return { type: "EXTERNAL", url: u.toString(), owner: null, repo: null };
}

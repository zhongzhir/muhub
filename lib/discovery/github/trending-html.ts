/**
 * GitHub Trending 无官方 API：抓取网页解析仓库全名，再调用 REST /repos 补全字段。
 * HTML 结构可能变更，解析尽量宽松。
 */

const REPO_PATH_RE = /href="(\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)\/?"/g;

const RESERVED_FIRST = new Set([
  "",
  "features",
  "topics",
  "collections",
  "trending",
  "explore",
  "sponsors",
  "settings",
  "login",
  "signup",
  "organisations",
  "enterprise",
]);

export function parseTrendingRepoFullNamesFromHtml(html: string, max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(REPO_PATH_RE);
  while ((m = re.exec(html)) !== null) {
    const path = m[1].replace(/\/$/, "");
    const parts = path.slice(1).split("/");
    if (parts.length !== 2) {
      continue;
    }
    const [a, b] = parts;
    if (!a || !b || RESERVED_FIRST.has(a.toLowerCase())) {
      continue;
    }
    const full = `${a}/${b}`.toLowerCase();
    if (seen.has(full)) {
      continue;
    }
    seen.add(full);
    out.push(`${a}/${b}`);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

export type FetchGithubTrendingPageResult =
  | { ok: true; html: string }
  | { ok: false; error: string; status?: number };

/** @since daily | weekly | monthly */
export async function fetchGithubTrendingHtml(options: {
  since: "daily" | "weekly" | "monthly";
  /** 如 `javascript`，空串表示不限语言 */
  spokenLanguageCode?: string;
  programmingLanguage?: string;
}): Promise<FetchGithubTrendingPageResult> {
  const { since, spokenLanguageCode = "", programmingLanguage = "" } = options;
  const sp = spokenLanguageCode ? `?spoken_language_code=${spokenLanguageCode}` : "";
  const base =
    programmingLanguage.trim() === ""
      ? `https://github.com/trending${sp}`
      : `https://github.com/trending/${encodeURIComponent(programmingLanguage)}${sp}`;
  const url = base.includes("?") ? `${base}&since=${since}` : `${base}?since=${since}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MUHUB-Discovery-V2",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `Trending page HTTP ${res.status}`,
        status: res.status,
      };
    }
    const html = await res.text();
    return { ok: true, html };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

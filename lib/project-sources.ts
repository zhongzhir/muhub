import type { ProjectSourceKind } from "@prisma/client";
import { parseRepoUrl } from "@/lib/repo-platform";

/** 详情 / 列表展示用的一条信息源 */
export type ProjectSourceDisplayItem = {
  id?: string;
  kind: ProjectSourceKind;
  url: string;
  /** 列表主文案（大类中文） */
  categoryLabel: string;
  /** 次要文案：自定义 label 或 Host */
  hint?: string;
  isPrimary: boolean;
};

const KIND_ORDER: ProjectSourceKind[] = [
  "GITHUB",
  "GITEE",
  "WEBSITE",
  "DOCS",
  "BLOG",
  "TWITTER",
];

const LABELS: Record<ProjectSourceKind, string> = {
  GITHUB: "GitHub",
  GITEE: "Gitee",
  WEBSITE: "官网",
  DOCS: "文档",
  BLOG: "博客",
  TWITTER: "X / Twitter",
};

/** 归一化 URL 比较 */
export function normalizeSourceUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    let out = u.toString();
    if (out.endsWith("/") && u.pathname !== "/") {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return url.trim();
  }
}

/** 展示用大类中文标签 */
export function mapSourceLabel(kind: ProjectSourceKind): string {
  return LABELS[kind] ?? kind;
}

/** 列表前缀小图标（纯 Unicode，零依赖） */
export function mapSourceEmoji(kind: ProjectSourceKind): string {
  switch (kind) {
    case "GITHUB":
      return "⌘";
    case "GITEE":
      return "Ⓖ";
    case "WEBSITE":
      return "🌐";
    case "DOCS":
      return "📄";
    case "BLOG":
      return "📝";
    case "TWITTER":
      return "𝕏";
    default:
      return "🔗";
  }
}

/**
 * 将表单 / 配置文件里的类型字符串映射为枚举。
 * 支持：github、gitee、website、docs、blog、twitter、social（映射 TWITTER）。
 */
export function normalizeSourceType(raw: string): ProjectSourceKind | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  switch (t) {
    case "github":
    case "gh":
      return "GITHUB";
    case "gitee":
      return "GITEE";
    case "website":
    case "web":
    case "site":
      return "WEBSITE";
    case "docs":
    case "documentation":
      return "DOCS";
    case "blog":
      return "BLOG";
    case "twitter":
    case "x":
    case "social":
      return "TWITTER";
    default:
      return null;
  }
}

/** 根据仓库主页 URL 推断 GITHUB / GITEE */
export function inferRepoSourceKind(repoUrl: string): ProjectSourceKind {
  const p = parseRepoUrl(repoUrl);
  if (p?.platform === "gitee") {
    return "GITEE";
  }
  return "GITHUB";
}

export type ProjectSourceRowInput = {
  id?: string;
  kind: ProjectSourceKind;
  url: string;
  label: string | null;
  isPrimary: boolean;
};

function hostHint(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function kindRank(k: ProjectSourceKind): number {
  const i = KIND_ORDER.indexOf(k);
  return i === -1 ? 999 : i;
}

type SourceAddInput = {
  id?: string;
  kind: ProjectSourceKind;
  url: string;
  label?: string | null;
  isPrimary: boolean;
};

/**
 * 合并库内 ProjectSource 行与旧版顶栏 githubUrl / websiteUrl（去重后用于 UI）。
 */
export function getProjectSources(input: {
  legacyGithubUrl?: string | null;
  legacyWebsiteUrl?: string | null;
  rows: ProjectSourceRowInput[];
}): ProjectSourceDisplayItem[] {
  const out: ProjectSourceDisplayItem[] = [];
  const seen = new Set<string>();

  const push = (item: SourceAddInput) => {
    const key = `${item.kind}:${normalizeSourceUrl(item.url)}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({
      id: item.id,
      kind: item.kind,
      url: item.url,
      isPrimary: item.isPrimary,
      categoryLabel: mapSourceLabel(item.kind),
      hint: item.label?.trim() || hostHint(item.url),
    });
  };

  for (const r of input.rows) {
    push({
      id: r.id,
      kind: r.kind,
      url: r.url,
      label: r.label,
      isPrimary: r.isPrimary,
    });
  }

  const gh = input.legacyGithubUrl?.trim();
  if (gh) {
    const kind = inferRepoSourceKind(gh);
    if (
      !input.rows.some(
        (r) =>
          (r.kind === "GITHUB" || r.kind === "GITEE") &&
          normalizeSourceUrl(r.url) === normalizeSourceUrl(gh),
      )
    ) {
      push({ kind, url: gh, isPrimary: true });
    }
  }

  const web = input.legacyWebsiteUrl?.trim();
  if (web) {
    if (
      !input.rows.some(
        (r) => r.kind === "WEBSITE" && normalizeSourceUrl(r.url) === normalizeSourceUrl(web),
      )
    ) {
      push({ kind: "WEBSITE", url: web, isPrimary: false });
    }
  }

  return out.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }
    const d = kindRank(a.kind) - kindRank(b.kind);
    if (d !== 0) {
      return d;
    }
    return a.url.localeCompare(b.url);
  });
}

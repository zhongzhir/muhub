"use server";

import { auth } from "@/auth";
import {
  fetchGitHubRepoForImport,
  fetchGiteeRepoApi,
  parseGitHubRepoUrl,
} from "@/lib/github";
import { parseProjectSourceUrl } from "@/lib/project-source-url";
import { parseRepoUrl } from "@/lib/repo-platform";
import type { ProjectSourceKind } from "@prisma/client";

/** 供「导入」预填写入 query 后由 resolveNewProjectPrefill 消费 */
export type ImportPrefillFields = {
  name: string;
  tagline: string;
  description: string;
  githubUrl: string;
  giteeUrl: string;
  websiteUrl: string;
  creationSource: string;
  extraSources?: { kind: ProjectSourceKind; url: string; label?: string | null }[];
};

export type ImportPrefillActionResult =
  | { ok: true; fields: ImportPrefillFields }
  | { ok: false; message: string };

function isProbablyHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function prefillProjectFromImportUrl(rawInput: string): Promise<ImportPrefillActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "请先登录后再使用导入预填。" };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, message: "请输入链接。" };
  }

  if (!isProbablyHttpUrl(trimmed)) {
    return { ok: false, message: "请输入以 http:// 或 https:// 开头的有效链接。" };
  }

  const ghDirect = parseGitHubRepoUrl(trimmed);
  if (ghDirect) {
    const result = await fetchGitHubRepoForImport(ghDirect.owner, ghDirect.repo);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return { ok: false, message: "未找到该 GitHub 仓库。" };
      }
      return { ok: false, message: "GitHub 请求失败，请稍后重试。" };
    }
    const d = result.data;
    const desc = d.tagline;
    return {
      ok: true,
      fields: {
        name: d.name,
        tagline: d.tagline,
        description: desc,
        githubUrl: d.githubUrl,
        giteeUrl: "",
        websiteUrl: d.websiteUrl,
        creationSource: "import",
      },
    };
  }

  const repo = parseRepoUrl(trimmed);
  if (repo?.platform === "gitee") {
    const r = await fetchGiteeRepoApi(repo.owner, repo.repo);
    if (r.kind === "not_found") {
      return { ok: false, message: "未找到该 Gitee 仓库。" };
    }
    if (r.kind === "error") {
      return { ok: false, message: "Gitee 请求失败，请稍后重试。" };
    }
    const j = r.json;
    const name = typeof j.name === "string" && j.name.trim() ? j.name.trim() : repo.repo;
    const longDesc = typeof j.description === "string" ? j.description.trim() : "";
    const htmlUrl =
      typeof j.html_url === "string" && j.html_url.trim()
        ? j.html_url.trim()
        : `https://gitee.com/${repo.owner}/${repo.repo}`;
    const homeRaw =
      (typeof j.homepage === "string" && j.homepage.trim() ? j.homepage.trim() : "") ||
      (typeof j.homepage_url === "string" && j.homepage_url.trim() ? j.homepage_url.trim() : "");
    const tagline = longDesc.length > 160 ? `${longDesc.slice(0, 157)}…` : longDesc || name;

    return {
      ok: true,
      fields: {
        name,
        tagline,
        description: longDesc,
        githubUrl: "",
        giteeUrl: htmlUrl,
        websiteUrl: homeRaw,
        creationSource: "import",
      },
    };
  }

  const source = parseProjectSourceUrl(trimmed);
  if (source?.type === "GITCC") {
    const segments = new URL(source.url).pathname.split("/").filter(Boolean);
    const fallbackName = segments.at(-1)?.replace(/\.git$/i, "") || "GitCC Project";
    return {
      ok: true,
      fields: {
        name: fallbackName,
        tagline: "",
        description: "",
        githubUrl: "",
        giteeUrl: "",
        websiteUrl: "",
        creationSource: "import",
        extraSources: [{ kind: "OTHER", url: source.url, label: "GitCC" }],
      },
    };
  }

  return {
    ok: false,
    message:
      "该类型链接的自动解析将后续支持。当前请使用 GitHub 或 Gitee 的仓库页面链接进行预填。",
  };
}

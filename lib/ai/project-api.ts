/**
 * 按 GitHub 仓库 URL 拉取元数据 +（可选）AI，输出结构化「项目整合」JSON。
 */

import {
  fetchGitHubRepoForImport,
  fetchGitHubLatestRelease,
  parseGitHubRepoUrl,
} from "@/lib/github";
import { generateProjectDescription, generateProjectTags, isAiConfigured } from "@/lib/ai/project-ai";

const E2E_FIXTURE_OWNER = "muhub";
const E2E_FIXTURE_REPO = "e2e-fixture";

export type ProjectApiUpdate = {
  title: string;
  summary?: string;
  sourceUrl?: string;
  /** ISO 8601 */
  occurredAt?: string;
};

export type ProjectApiSource = {
  kind: "GITHUB" | "WEBSITE";
  url: string;
  label?: string;
};

export type ProjectSummaryPayload = {
  name: string;
  summary: string;
  tags: string[];
  updates: ProjectApiUpdate[];
  sources: ProjectApiSource[];
};

export type FetchProjectSummaryResult =
  | { ok: true; data: ProjectSummaryPayload }
  | { ok: false; error: "invalid_url" | "repo_not_found" | "api_error" };

function githubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MUHUB-ProjectApi",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function firstLineMessage(message: string): string {
  const line = message.split(/\r?\n/)[0]?.trim() || message.trim();
  return line.slice(0, 200);
}

async function fetchRecentGithubCommits(
  owner: string,
  repo: string,
  limit: number,
): Promise<ProjectApiUpdate[]> {
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo,
    )}/commits?per_page=${limit}`;
    const res = await fetch(url, { headers: githubHeaders(), cache: "no-store" });
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) {
      return [];
    }
    const out: ProjectApiUpdate[] = [];
    for (const row of json) {
      const o = row as {
        html_url?: string;
        commit?: { message?: string; author?: { date?: string } };
      };
      const msg = typeof o.commit?.message === "string" ? o.commit.message : "";
      if (!msg.trim()) {
        continue;
      }
      const title = firstLineMessage(msg);
      const rest = msg.split(/\r?\n/).slice(1).join("\n").trim();
      const d = o.commit?.author?.date;
      out.push({
        title,
        summary: rest ? rest.slice(0, 400) : undefined,
        sourceUrl: typeof o.html_url === "string" ? o.html_url : undefined,
        occurredAt: typeof d === "string" && d ? d : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function e2eFixturePayload(): ProjectSummaryPayload {
  const base = `https://github.com/${E2E_FIXTURE_OWNER}/${E2E_FIXTURE_REPO}`;
  return {
    name: "E2E Fixture Repo",
    summary: "Playwright 导入/ API 固定用例仓库，不访问外网。",
    tags: ["e2e", "fixture", "muhub"],
    updates: [
      {
        title: "Release v0.0.1-fixture",
        summary: "E2E fixture release entry",
        sourceUrl: `${base}/releases/tag/v0.0.1-fixture`,
        occurredAt: new Date().toISOString(),
      },
      {
        title: "chore: fixture commit",
        summary: "CI fixture",
        sourceUrl: `${base}/commit/0000000`,
        occurredAt: new Date().toISOString(),
      },
    ],
    sources: [
      { kind: "GITHUB", url: base, label: "GitHub" },
      { kind: "WEBSITE", url: "https://example.com", label: "官网" },
    ],
  };
}

/**
 * 解析 GitHub 仓库 URL，拉取 REST 元数据与近期提交/Release，并可选调用 AI 生成 summary/tags。
 */
export async function fetchProjectSummary(githubUrl: string): Promise<FetchProjectSummaryResult> {
  const trimmed = githubUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "invalid_url" };
  }

  const parsed = parseGitHubRepoUrl(trimmed);
  if (!parsed) {
    return { ok: false, error: "invalid_url" };
  }

  const { owner, repo } = parsed;

  if (
    process.env.GITHUB_IMPORT_E2E_FIXTURE === "1" &&
    owner === E2E_FIXTURE_OWNER &&
    repo === E2E_FIXTURE_REPO
  ) {
    return { ok: true, data: e2eFixturePayload() };
  }

  const repoRes = await fetchGitHubRepoForImport(owner, repo);
  if (!repoRes.ok) {
    return { ok: false, error: repoRes.reason === "not_found" ? "repo_not_found" : "api_error" };
  }

  const r = repoRes.data;
  const headers = githubHeaders();

  const [release, commitUpdates] = await Promise.all([
    fetchGitHubLatestRelease(owner, repo, headers),
    fetchRecentGithubCommits(owner, repo, 5),
  ]);

  const updates: ProjectApiUpdate[] = [];
  if (release) {
    const tag = release.tag;
    const releaseUrl = `${r.githubUrl}/releases/tag/${encodeURIComponent(tag)}`;
    updates.push({
      title: `Release ${tag}`,
      summary: release.publishedAt ? `发布于 ${release.publishedAt.toISOString().slice(0, 10)}` : undefined,
      sourceUrl: releaseUrl,
      occurredAt: release.publishedAt?.toISOString(),
    });
  }
  for (const u of commitUpdates) {
    if (updates.length >= 6) {
      break;
    }
    updates.push(u);
  }

  const sources: ProjectApiSource[] = [{ kind: "GITHUB", url: r.githubUrl, label: "GitHub" }];
  if (r.websiteUrl?.trim()) {
    sources.push({ kind: "WEBSITE", url: r.websiteUrl.trim(), label: "官网" });
  }

  let summary: string | null = null;
  let tags: string[] = [];

  if (isAiConfigured()) {
    const [desc, tagResult] = await Promise.all([
      generateProjectDescription({
        name: r.name,
        tagline: r.tagline || null,
        githubUrl: r.githubUrl,
      }),
      generateProjectTags({
        name: r.name,
        tagline: r.tagline || null,
        githubUrl: r.githubUrl,
      }),
    ]);
    summary = desc;
    tags = tagResult ?? [];
  }

  if (!summary?.trim()) {
    summary = r.tagline?.trim() ? r.tagline.trim() : `${r.name}（GitHub 仓库暂无描述，可配置 OPENAI_API_KEY 生成 AI 摘要。）`;
  }

  const data: ProjectSummaryPayload = {
    name: r.name,
    summary: summary.trim(),
    tags,
    updates,
    sources,
  };

  return { ok: true, data };
}

import { prisma } from "@/lib/prisma";
import { parseGitHubRepoUrl } from "@/lib/github";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import {
  appendProjectActivity,
  readProjectActivities,
  type ProjectActivity,
} from "./project-activity-store";

type GitHubRepoApi = {
  full_name?: string;
  stargazers_count?: number;
  pushed_at?: string | null;
};

type GitHubReleaseApi = {
  tag_name?: string;
  name?: string | null;
  published_at?: string | null;
  html_url?: string;
};

function buildGitHubHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_ACCESS_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "MUHUB-Project-Activity",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function toIsoOrNow(input?: string | null): string {
  if (!input) {
    return new Date().toISOString();
  }
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}

function latestByType(
  list: ProjectActivity[],
  projectSlug: string,
  type: ProjectActivity["type"],
): ProjectActivity | undefined {
  return [...list]
    .reverse()
    .find((row) => row.projectSlug === projectSlug && row.type === type);
}

export type GitHubProjectActivityRunSummary = {
  scannedProjects: number;
  withGithubUrl: number;
  inserted: { release: number; star: number; update: number };
  skipped: { release: number; star: number; update: number };
  failed: number;
};

export async function runGitHubProjectActivity(): Promise<GitHubProjectActivityRunSummary> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      scannedProjects: 0,
      withGithubUrl: 0,
      inserted: { release: 0, star: 0, update: 0 },
      skipped: { release: 0, star: 0, update: 0 },
      failed: 0,
    };
  }

  const projects = await prisma.project.findMany({
    where: { ...PROJECT_ACTIVE_FILTER },
    select: { slug: true, name: true, githubUrl: true },
  });
  const withGithub = projects.filter((p) => p.githubUrl && p.githubUrl.trim());
  const headers = buildGitHubHeaders();
  const existing = await readProjectActivities();
  const result: GitHubProjectActivityRunSummary = {
    scannedProjects: projects.length,
    withGithubUrl: withGithub.length,
    inserted: { release: 0, star: 0, update: 0 },
    skipped: { release: 0, star: 0, update: 0 },
    failed: 0,
  };

  for (const p of withGithub) {
    const parsed = parseGitHubRepoUrl(p.githubUrl ?? "");
    if (!parsed) {
      result.failed += 1;
      continue;
    }
    const repoApiUrl = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`;
    try {
      const repoRes = await fetch(repoApiUrl, { headers, cache: "no-store" });
      if (!repoRes.ok) {
        result.failed += 1;
        continue;
      }
      const repo = (await repoRes.json()) as GitHubRepoApi;
      const repoFullName = repo.full_name ?? `${parsed.owner}/${parsed.repo}`;
      const stars = typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0;
      const pushedAt = toIsoOrNow(repo.pushed_at ?? null);

      const prevStar = latestByType(existing, p.slug, "star");
      if (!prevStar || prevStar.stars !== stars) {
        const inserted = await appendProjectActivity({
          type: "star",
          projectSlug: p.slug,
          projectName: p.name,
          githubUrl: p.githubUrl ?? "",
          repoFullName,
          title: `GitHub Stars 更新为 ${stars}`,
          summary: `仓库 ${repoFullName} 当前 Star 数：${stars}`,
          occurredAt: new Date().toISOString(),
          stars,
        });
        if (inserted) {
          result.inserted.star += 1;
          existing.push(inserted);
        } else {
          result.skipped.star += 1;
        }
      } else {
        result.skipped.star += 1;
      }

      const prevUpdate = latestByType(existing, p.slug, "update");
      if (!prevUpdate || prevUpdate.pushedAt !== pushedAt) {
        const inserted = await appendProjectActivity({
          type: "update",
          projectSlug: p.slug,
          projectName: p.name,
          githubUrl: p.githubUrl ?? "",
          repoFullName,
          title: "代码仓库有新提交",
          summary: `最近推送时间：${pushedAt}`,
          occurredAt: pushedAt,
          pushedAt,
        });
        if (inserted) {
          result.inserted.update += 1;
          existing.push(inserted);
        } else {
          result.skipped.update += 1;
        }
      } else {
        result.skipped.update += 1;
      }

      const releaseRes = await fetch(`${repoApiUrl}/releases/latest`, {
        headers,
        cache: "no-store",
      });
      if (releaseRes.ok) {
        const release = (await releaseRes.json()) as GitHubReleaseApi;
        const tag = release.tag_name?.trim();
        if (tag) {
          const occurredAt = toIsoOrNow(release.published_at ?? null);
          const prevRelease = latestByType(existing, p.slug, "release");
          if (!prevRelease || prevRelease.releaseTag !== tag) {
            const inserted = await appendProjectActivity({
              type: "release",
              projectSlug: p.slug,
              projectName: p.name,
              githubUrl: p.githubUrl ?? "",
              repoFullName,
              title: `发布新版本 ${tag}`,
              summary: release.name?.trim() || release.html_url || undefined,
              occurredAt,
              releaseTag: tag,
            });
            if (inserted) {
              result.inserted.release += 1;
              existing.push(inserted);
            } else {
              result.skipped.release += 1;
            }
          } else {
            result.skipped.release += 1;
          }
        } else {
          result.skipped.release += 1;
        }
      } else {
        result.skipped.release += 1;
      }
    } catch (e) {
      console.warn(`[ProjectActivity] failed for ${p.slug}`, e);
      result.failed += 1;
    }
  }
  return result;
}

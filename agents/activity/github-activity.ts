import { prisma } from "@/lib/prisma";
import { parseGitHubRepoUrl } from "@/lib/github";
import { parseProjectSourceUrl } from "@/lib/project-source-url";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { createProjectActivity } from "@/lib/activity/project-activity-service";

type GitHubRepoApi = {
  full_name?: string;
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

export type GitHubProjectActivityRunSummary = {
  scannedProjects: number;
  withGithubUrl: number;
  inserted: { release: number; update: number };
  skipped: { release: number; update: number };
  failed: number;
};

export async function runGitHubProjectActivity(): Promise<GitHubProjectActivityRunSummary> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      scannedProjects: 0,
      withGithubUrl: 0,
      inserted: { release: 0, update: 0 },
      skipped: { release: 0, update: 0 },
      failed: 0,
    };
  }

  const projects = await prisma.project.findMany({
    where: { ...PROJECT_ACTIVE_FILTER },
    select: { id: true, slug: true, name: true, githubUrl: true },
  });
  const withGithub = projects.filter(
    (p) => parseProjectSourceUrl(p.githubUrl ?? "")?.type === "GITHUB",
  );
  const headers = buildGitHubHeaders();
  const result: GitHubProjectActivityRunSummary = {
    scannedProjects: projects.length,
    withGithubUrl: withGithub.length,
    inserted: { release: 0, update: 0 },
    skipped: { release: 0, update: 0 },
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
      const pushedAt = toIsoOrNow(repo.pushed_at ?? null);

      const update = await createProjectActivity({
        projectId: p.id,
        type: "github_repo_updated",
        title: "GitHub 仓库有新提交",
        summary: `仓库 ${repoFullName} 最近推送时间：${pushedAt}`,
        sourceType: "github",
        sourceUrl: p.githubUrl ?? null,
        occurredAt: new Date(pushedAt),
        dedupeKey: `github_repo_updated:${repoFullName}:${pushedAt}`,
        metadataJson: { repoFullName, pushedAt },
      });
      if (update.created) {
        result.inserted.update += 1;
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
          const created = await createProjectActivity({
            projectId: p.id,
            type: "github_release_detected",
            title: `检测到新版本 ${tag}`,
            summary: release.name?.trim() || release.html_url || null,
            sourceType: "github",
            sourceUrl: release.html_url || p.githubUrl || null,
            occurredAt: new Date(occurredAt),
            dedupeKey: `github_release_detected:${repoFullName}:${tag}`,
            metadataJson: { repoFullName, releaseTag: tag },
          });
          if (created.created) {
            result.inserted.release += 1;
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

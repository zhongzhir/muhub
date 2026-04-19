/**
 * 轻量「运营」检查：无真实 cron，由 scripts/run_ai_update.ts 手动触发。
 * 项目间可用 spacingMs 做简单节流，避免瞬间打满 API。
 */

import {
  generateRepoActivityCronLine,
  generateProjectHeroCardSummary,
  isAiConfigured,
} from "@/lib/ai/project-ai";
import { createReleaseProjectUpdate } from "@/lib/github-release-update";
import type { GithubSnapshotPayload } from "@/lib/github-sync";
import { fetchLiveRepoSnapshotForUrl } from "@/lib/github-sync";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";
import { parseRepoUrl } from "@/lib/repo-platform";

const COMMIT_DELTA_MS = 120_000;
const ACTIVITY_COOLDOWN_MS = 7 * 86_400_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type SnapshotHead = {
  lastCommitAt: Date | null;
  latestReleaseTag: string | null;
};

function normTag(t: string | null | undefined): string {
  return (t ?? "").trim();
}

function releaseMeaningfullyChanged(prev: SnapshotHead, live: GithubSnapshotPayload): boolean {
  return normTag(prev.latestReleaseTag) !== normTag(live.latestReleaseTag);
}

function commitAdvanced(prev: SnapshotHead, live: GithubSnapshotPayload): boolean {
  if (!live.lastCommitAt) return false;
  if (!prev.lastCommitAt) return true;
  return live.lastCommitAt.getTime() - prev.lastCommitAt.getTime() > COMMIT_DELTA_MS;
}

export type CheckProjectUpdatesResult = {
  checked: number;
  skippedNoSnapshot: number;
  skippedNoChange: number;
  snapshotsWritten: number;
  releaseUpdates: number;
  activityUpdates: number;
  errors: string[];
};

export type CheckProjectUpdatesOptions = {
  limit?: number;
  /** 每条项目处理前的间隔（毫秒），简单避免 burst */
  spacingMs?: number;
};

async function appendSnapshot(projectId: string, live: GithubSnapshotPayload): Promise<void> {
  await prisma.githubRepoSnapshot.create({
    data: {
      projectId,
      repoPlatform: live.repoPlatform,
      repoOwner: live.repoOwner,
      repoName: live.repoName,
      repoFullName: live.repoFullName,
      defaultBranch: live.defaultBranch,
      stars: live.stars,
      forks: live.forks,
      openIssues: live.openIssues,
      watchers: live.watchers,
      commitCount7d: 0,
      commitCount30d: 0,
      contributorsCount: live.contributorsCount,
      lastCommitAt: live.lastCommitAt,
      latestReleaseTag: live.latestReleaseTag,
      latestReleaseAt: live.latestReleaseAt,
    },
  });
}

async function maybePostActivityUpdate(
  projectId: string,
  projectName: string,
  live: GithubSnapshotPayload,
): Promise<boolean> {
  const recent = await prisma.projectUpdate.findFirst({
    where: {
      projectId,
      sourceType: "AI",
      title: "仓库活跃度更新",
      createdAt: { gte: new Date(Date.now() - ACTIVITY_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recent) {
    return false;
  }

  let body =
    "检测到仓库近期有新的提交活动，项目仍在持续更新中。";
  if (isAiConfigured()) {
    const hint = live.lastCommitAt
      ? live.lastCommitAt.toISOString()
      : "最近有推送";
    const aiLine = await generateRepoActivityCronLine({
      projectName,
      repoFullName: live.repoFullName,
      lastCommitHint: hint,
    });
    if (aiLine?.trim()) {
      body = aiLine.trim();
    }
  }

  await prisma.projectUpdate.create({
    data: {
      projectId,
      sourceType: "AI",
      sourceLabel: "AI 更新",
      title: "仓库活跃度更新",
      content: body,
      isAiGenerated: true,
      occurredAt: live.lastCommitAt ?? new Date(),
    },
  });
  return true;
}

/**
 * 遍历近期有快照且有仓库地址的项目：远端对比 lastCommit / Release，
 * 有变化则写入新快照；新版本走 Release 动态；仅提交推进可走 AI 活跃度动态（带冷却）。
 */
export async function checkProjectUpdates(
  options: CheckProjectUpdatesOptions = {},
): Promise<CheckProjectUpdatesResult> {
  const limit = options.limit ?? 20;
  const spacingMs = options.spacingMs ?? 0;
  const result: CheckProjectUpdatesResult = {
    checked: 0,
    skippedNoSnapshot: 0,
    skippedNoChange: 0,
    snapshotsWritten: 0,
    releaseUpdates: 0,
    activityUpdates: 0,
    errors: [],
  };

  if (!process.env.DATABASE_URL?.trim()) {
    result.errors.push("未配置 DATABASE_URL");
    return result;
  }

  const projects = await prisma.project.findMany({
    where: {
      githubUrl: { not: null },
      NOT: { githubUrl: "" },
      status: { in: ["READY", "PUBLISHED"] },
      githubSnapshots: { some: {} },
      ...PROJECT_ACTIVE_FILTER,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, slug: true, name: true, githubUrl: true },
  });

  for (let i = 0; i < projects.length; i++) {
    if (spacingMs > 0 && i > 0) {
      await sleep(spacingMs);
    }
    const p = projects[i];
    const url = p.githubUrl?.trim();
    if (!url) continue;
    result.checked += 1;

    const latest = await prisma.githubRepoSnapshot.findFirst({
      where: { projectId: p.id },
      orderBy: { fetchedAt: "desc" },
      select: {
        lastCommitAt: true,
        latestReleaseTag: true,
      },
    });
    if (!latest) {
      result.skippedNoSnapshot += 1;
      continue;
    }

    const prev: SnapshotHead = {
      lastCommitAt: latest.lastCommitAt,
      latestReleaseTag: latest.latestReleaseTag,
    };

    const live = await fetchLiveRepoSnapshotForUrl(url);
    if (!live.ok) {
      result.errors.push(`${p.slug}: ${live.reason}`);
      continue;
    }

    const relChanged = releaseMeaningfullyChanged(prev, live.data);
    const commitOk = commitAdvanced(prev, live.data);

    if (!relChanged && !commitOk) {
      result.skippedNoChange += 1;
      continue;
    }

    try {
      await appendSnapshot(p.id, live.data);
      result.snapshotsWritten += 1;

      const tag = live.data.latestReleaseTag?.trim();
      const releaseAt = live.data.latestReleaseAt;
      if (tag && releaseAt && relChanged) {
        const parsed = parseRepoUrl(url);
        if (parsed) {
          await createReleaseProjectUpdate({
            projectId: p.id,
            platform: parsed.platform,
            owner: parsed.owner,
            repo: parsed.repo,
            tag,
            releaseAt,
          });
          result.releaseUpdates += 1;
        }
      } else if (commitOk && !relChanged) {
        const posted = await maybePostActivityUpdate(p.id, p.name, live.data);
        if (posted) {
          result.activityUpdates += 1;
        }
      }
    } catch (e) {
      result.errors.push(`${p.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

export type RefreshAiCardSummariesResult = {
  candidates: number;
  updated: number;
  skipped: number;
};

/**
 * 为尚未生成摘要卡的项目写入 aiCardSummary（需 description 或 tags；无 API key 则跳过）。
 */
export async function refreshProjectAiCardSummaries(
  opts: { limit?: number } = {},
): Promise<RefreshAiCardSummariesResult> {
  const limit = opts.limit ?? 30;
  const out: RefreshAiCardSummariesResult = { candidates: 0, updated: 0, skipped: 0 };

  if (!process.env.DATABASE_URL?.trim()) {
    return out;
  }
  if (!isAiConfigured()) {
    out.skipped += 1;
    return out;
  }

  const rows = await prisma.project.findMany({
    where: { aiCardSummary: null, ...PROJECT_ACTIVE_FILTER },
    take: Math.min(80, limit * 3),
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      description: true,
      tags: true,
    },
  });

  const picked = rows
    .filter((r) => Boolean(r.description?.trim()) || (r.tags?.length ?? 0) > 0)
    .slice(0, limit);
  out.candidates = picked.length;

  for (const r of picked) {
    const text = await generateProjectHeroCardSummary({
      name: r.name,
      tagline: r.tagline,
      description: r.description ?? "",
      tags: r.tags ?? [],
    });
    if (!text?.trim()) {
      out.skipped += 1;
      continue;
    }
    try {
      await prisma.project.update({
        where: { id: r.id },
        data: { aiCardSummary: text.trim() },
      });
      out.updated += 1;
    } catch {
      out.skipped += 1;
    }
  }

  return out;
}

/**
 * 批量刷新已有项目的 GitHub 仓库快照（GithubRepoSnapshot）。
 *
 * 运行：pnpm github:refresh
 *
 * 环境变量：
 * - LIMIT=50        每批处理数量（默认 50）
 * - OFFSET=0        跳过前 N 条（默认 0）
 * - QUERY=awesome   按 name / slug / githubUrl 模糊搜索
 * - ONLY_ZERO=1     仅处理无快照，或 forks/watchers/openIssues 均为 0 的项目
 */

import { refreshProjectGithubFacts } from "@/lib/github-sync";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type FailedDetail = {
  projectId: string;
  slug: string;
  name: string;
  error: string;
};

type RefreshGithubFactsSummary = {
  checked: number;
  refreshed: number;
  failed: number;
  skipped: number;
  failedDetails: FailedDetail[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLimit(defaultValue = 50): number {
  const raw = process.env.LIMIT?.trim();
  if (!raw) {
    return defaultValue;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`无效的 LIMIT=${raw}`);
  }
  return Math.floor(parsed);
}

function readOffset(): number {
  const raw = process.env.OFFSET?.trim();
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`无效的 OFFSET=${raw}`);
  }
  return Math.floor(parsed);
}

function readQuery(): string | null {
  const raw = process.env.QUERY?.trim();
  return raw ? raw : null;
}

function isOnlyZeroMode(): boolean {
  return process.env.ONLY_ZERO?.trim() === "1";
}

function buildProjectWhere(query: string | null): Prisma.ProjectWhereInput {
  const repoClause: Prisma.ProjectWhereInput = {
    OR: [
      {
        AND: [{ githubUrl: { not: null } }, { NOT: { githubUrl: "" } }],
      },
      {
        sources: {
          some: { kind: "GITHUB" },
        },
      },
    ],
  };

  if (!query) {
    return {
      ...PROJECT_ACTIVE_FILTER,
      ...repoClause,
    };
  }

  return {
    ...PROJECT_ACTIVE_FILTER,
    AND: [
      repoClause,
      {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
          { githubUrl: { contains: query, mode: "insensitive" } },
        ],
      },
    ],
  };
}

function needsGithubFactsRefresh(
  snapshot:
    | {
        forks: number;
        watchers: number;
        openIssues: number;
      }
    | null
    | undefined,
): boolean {
  if (!snapshot) {
    return true;
  }
  return snapshot.forks === 0 && snapshot.watchers === 0 && snapshot.openIssues === 0;
}

async function loadCandidateProjects(query: string | null) {
  return prisma.project.findMany({
    where: buildProjectWhere(query),
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      githubUrl: true,
      githubSnapshots: {
        orderBy: { fetchedAt: "desc" },
        take: 1,
        select: {
          forks: true,
          watchers: true,
          openIssues: true,
        },
      },
    },
  });
}

async function selectProjectsToProcess(input: {
  query: string | null;
  offset: number;
  limit: number;
  onlyZero: boolean;
}) {
  const rows = await loadCandidateProjects(input.query);

  const filtered = input.onlyZero
    ? rows.filter((row) => needsGithubFactsRefresh(row.githubSnapshots[0]))
    : rows;

  return filtered.slice(input.offset, input.offset + input.limit);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[github:refresh] 未设置 DATABASE_URL，请在 .env 中配置。");
    process.exit(1);
  }

  const limit = readLimit();
  const offset = readOffset();
  const query = readQuery();
  const onlyZero = isOnlyZeroMode();

  console.log("[github:refresh] start", {
    limit,
    offset,
    query: query ?? null,
    onlyZero,
  });

  const projects = await selectProjectsToProcess({
    query,
    offset,
    limit,
    onlyZero,
  });

  const summary: RefreshGithubFactsSummary = {
    checked: 0,
    refreshed: 0,
    failed: 0,
    skipped: 0,
    failedDetails: [],
  };

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    summary.checked += 1;

    const result = await refreshProjectGithubFacts(project.id);
    if (result.ok && result.refreshed) {
      summary.refreshed += 1;
      console.log("[github:refresh] refreshed", {
        slug: project.slug,
        name: project.name,
        githubUrl: project.githubUrl,
      });
    } else if (result.ok && !result.refreshed) {
      summary.skipped += 1;
      console.log("[github:refresh] skipped", {
        slug: project.slug,
        reason: result.reason,
      });
    } else {
      summary.failed += 1;
      summary.failedDetails.push({
        projectId: project.id,
        slug: project.slug,
        name: project.name,
        error: result.lastFetchError,
      });
      console.warn("[github:refresh] failed", {
        slug: project.slug,
        error: result.lastFetchError,
      });
    }

    if (i < projects.length - 1) {
      await sleep(500);
    }
  }

  console.log("\n=== github:refresh summary ===");
  console.log(`checked: ${summary.checked}`);
  console.log(`refreshed: ${summary.refreshed}`);
  console.log(`failed: ${summary.failed}`);
  console.log(`skipped: ${summary.skipped}`);
  if (summary.failedDetails.length > 0) {
    console.log("failed details:");
    for (const detail of summary.failedDetails) {
      console.log(`  - ${detail.slug} (${detail.projectId}): ${detail.error}`);
    }
  }

  await prisma.$disconnect();
  process.exit(summary.failed > 0 ? 1 : 0);
}

void main().catch(async (error) => {
  console.error("[github:refresh] fatal", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

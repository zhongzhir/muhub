/**
 * 按 ProjectSource.kind 分发抓取（首版：WEBSITE / BLOG / DOCS 共用 HTML 首页策略）。
 */

import type { ProjectSourceKind, ProjectUpdateSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchWebsiteUpdates } from "@/lib/source-fetch/fetch-website";
import { normalizeSourceUrl } from "@/lib/project-sources";

export type FetchProjectSourceUpdatesResult = {
  projectId: string;
  examined: number;
  created: number;
  skipped: number;
  errors: string[];
};

function mapKindToUpdateType(kind: ProjectSourceKind): ProjectUpdateSourceType | null {
  switch (kind) {
    case "WEBSITE":
      return "WEBSITE";
    case "BLOG":
      return "BLOG";
    case "DOCS":
      return "DOCS";
    default:
      return null;
  }
}

const FETCHABLE: ProjectSourceKind[] = ["WEBSITE", "BLOG", "DOCS"];

/**
 * 读取项目下可抓取的信息源，写入新的 ProjectUpdate（按 sourceUrl 去重）。
 */
export async function fetchProjectSourceUpdates(
  projectId: string,
): Promise<FetchProjectSourceUpdatesResult> {
  const out: FetchProjectSourceUpdatesResult = {
    projectId,
    examined: 0,
    created: 0,
    skipped: 0,
    errors: [],
  };

  if (!process.env.DATABASE_URL?.trim()) {
    out.errors.push("未配置 DATABASE_URL");
    return out;
  }

  const sources = await prisma.projectSource.findMany({
    where: {
      projectId,
      kind: { in: FETCHABLE },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const src of sources) {
    out.examined += 1;
    const updateType = mapKindToUpdateType(src.kind);
    if (!updateType) {
      continue;
    }

    let items: Awaited<ReturnType<typeof fetchWebsiteUpdates>>;
    try {
      items = await fetchWebsiteUpdates(src.url);
    } catch (e) {
      out.errors.push(`${src.id}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (const item of items) {
      const norm = normalizeSourceUrl(item.url);
      const existing = await prisma.projectUpdate.findFirst({
        where: {
          projectId,
          sourceUrl: norm,
        },
        select: { id: true },
      });
      if (existing) {
        out.skipped += 1;
        continue;
      }

      try {
        await prisma.projectUpdate.create({
          data: {
            projectId,
            sourceType: updateType,
            sourceLabel: null,
            title: item.title.slice(0, 500),
            summary: `来自信息源快照：${item.title.slice(0, 200)}`,
            content: `页面标题：${item.title}\n\n抓取地址：${item.url}`,
            sourceUrl: norm,
            occurredAt: item.publishedAt ?? undefined,
            isAiGenerated: false,
            metaJson: JSON.stringify({ projectSourceId: src.id, fetchedBy: "source-fetch/v1" }),
          },
        });
        out.created += 1;
      } catch (e) {
        out.errors.push(`create ${norm}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return out;
}

import Link from "next/link";
import {
  computeProjectCompleteness,
  completenessInputFromParts,
} from "@/lib/project-completeness";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminProjectQualityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const sortLowFirst =
    (Array.isArray(sp.sort) ? sp.sort[0] : sp.sort)?.trim() !== "high";

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
        未配置 DATABASE_URL
      </div>
    );
  }

  const rows = await prisma.project.findMany({
    where: PROJECT_ACTIVE_FILTER,
    select: {
      id: true,
      slug: true,
      name: true,
      visibilityStatus: true,
      tagline: true,
      description: true,
      primaryCategory: true,
      tags: true,
      websiteUrl: true,
      githubUrl: true,
      discoverySource: true,
      discoveredAt: true,
      sources: { select: { kind: true } },
      externalLinks: { select: { platform: true } },
    },
    take: 500,
    orderBy: { updatedAt: "desc" },
  });

  const decorated = rows.map((r) => {
    const comp = computeProjectCompleteness(
      completenessInputFromParts({
        name: r.name,
        tagline: r.tagline,
        description: r.description,
        primaryCategory: r.primaryCategory,
        tags: r.tags,
        websiteUrl: r.websiteUrl,
        githubUrl: r.githubUrl,
        sources: r.sources,
        externalLinks: r.externalLinks,
      }),
    );
    const hasWebsite =
      Boolean(r.websiteUrl?.trim()) || r.sources.some((s) => s.kind === "WEBSITE");
    const hasGh =
      Boolean(r.githubUrl?.trim()) ||
      r.sources.some((s) => s.kind === "GITHUB" || s.kind === "GITEE");
    const hasDocs =
      r.sources.some((s) => s.kind === "DOCS") ||
      r.externalLinks.some((e) => e.platform.toLowerCase() === "docs");
    return { r, comp, hasWebsite, hasGh, hasDocs };
  });

  decorated.sort((a, b) => {
    const d = sortLowFirst
      ? a.comp.completenessScore - b.comp.completenessScore
      : b.comp.completenessScore - a.comp.completenessScore;
    if (d !== 0) {
      return d;
    }
    return a.r.name.localeCompare(b.r.name, "zh-CN");
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">项目质量 / 完整度</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          规则化完整度评分，便于优先补全低分项目。默认低分优先；切换排序见下方链接。
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {sortLowFirst ? (
            <Link href="/admin/projects/quality?sort=high" className="text-blue-600 underline dark:text-blue-400">
              按完整度从高到低
            </Link>
          ) : (
            <Link href="/admin/projects/quality" className="text-blue-600 underline dark:text-blue-400">
              按完整度从低到高
            </Link>
          )}
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">项目</th>
              <th className="px-3 py-2">可见性</th>
              <th className="px-3 py-2">完整度</th>
              <th className="px-3 py-2">主类型</th>
              <th className="px-3 py-2">官网</th>
              <th className="px-3 py-2">仓库</th>
              <th className="px-3 py-2">文档</th>
              <th className="px-3 py-2">标签数</th>
              <th className="px-3 py-2">Discovery</th>
              <th className="px-3 py-2">发现时间</th>
            </tr>
          </thead>
          <tbody>
            {decorated.map(({ r, comp, hasWebsite, hasGh, hasDocs }) => (
              <tr
                key={r.id}
                className="border-b border-zinc-100 dark:border-zinc-800/80"
              >
                <td className="max-w-[200px] px-3 py-2">
                  <Link
                    href={`/projects/${encodeURIComponent(r.slug)}`}
                    className="font-medium text-blue-700 underline dark:text-blue-400"
                  >
                    {r.name}
                  </Link>
                  <div className="font-mono text-[10px] text-zinc-500">{r.slug}</div>
                </td>
                <td className="px-3 py-2 text-xs">{r.visibilityStatus}</td>
                <td className="px-3 py-2 tabular-nums font-medium">{comp.completenessScore}</td>
                <td className="max-w-[120px] truncate px-3 py-2 text-xs">
                  {r.primaryCategory ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs">{hasWebsite ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-xs">{hasGh ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-xs">{hasDocs ? "✓" : "—"}</td>
                <td className="px-3 py-2 tabular-nums">{r.tags.length}</td>
                <td className="max-w-[100px] truncate px-3 py-2 text-[11px] text-zinc-600">
                  {r.discoverySource ?? "—"}
                </td>
                <td className="px-3 py-2 text-[11px] text-zinc-500">
                  {r.discoveredAt ? r.discoveredAt.toISOString().slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {decorated.length === 0 ? (
          <p className="p-6 text-center text-sm text-zinc-500">暂无项目</p>
        ) : null}
      </div>
    </div>
  );
}

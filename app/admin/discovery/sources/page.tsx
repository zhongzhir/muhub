import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureDiscoveryDefaultSources } from "@/lib/discovery/seed-default-sources";
import { mergeAdminCandidateListUrl } from "@/lib/discovery/admin-candidate-list-url";
import { RunDiscoverySourceButton } from "../run-discovery-source-button";

export const dynamic = "force-dynamic";

export default async function AdminDiscoverySourcesPage() {
  await ensureDiscoveryDefaultSources();

  const sources = await prisma.discoverySource.findMany({
    orderBy: { key: "asc" },
    include: {
      runs: {
        take: 1,
        orderBy: { startedAt: "desc" },
        select: {
          id: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          fetchedCount: true,
          parsedCount: true,
          newCandidateCount: true,
          updatedCandidateCount: true,
          errorMessage: true,
        },
      },
    },
  });

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery" className="underline">
          ← 候选列表
        </Link>
      </p>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">项目发现来源与运行状态</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          查看各抓取源最近状态；手动触发运行；跳转筛选后的候选池。
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">名称 / key</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">最近执行</th>
              <th className="px-3 py-2">成功/失败</th>
              <th className="px-3 py-2">最近执行统计</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const run = s.runs[0];
              return (
                <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/discovery/sources/${s.id}`}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {s.name}
                    </Link>
                    <div className="font-mono text-[10px] text-zinc-500">{s.key}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {s.type}
                    {s.subtype ? ` / ${s.subtype}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs">{s.status}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {s.lastRunAt?.toISOString().slice(0, 19) ?? "—"}
                  </td>
                  <td className="max-w-[200px] px-3 py-2 text-[10px] text-zinc-600">
                    <div>✓ {s.lastSuccessAt?.toISOString().slice(0, 10) ?? "—"}</div>
                    <div className="text-amber-800 dark:text-amber-200">
                      ✗ {s.lastErrorAt?.toISOString().slice(0, 10) ?? "—"}
                    </div>
                    {s.lastErrorMessage ? (
                      <div className="mt-1 line-clamp-2 text-zinc-500" title={s.lastErrorMessage}>
                        {s.lastErrorMessage}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-zinc-600">
                    {run ? (
                      <>
                        <div>st {run.status}</div>
                        <div>
                          fetch {run.fetchedCount} / parse {run.parsedCount}
                        </div>
                        <div>
                          +{run.newCandidateCount} ~{run.updatedCandidateCount}
                        </div>
                      </>
                    ) : (
                      "无记录"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <RunDiscoverySourceButton sourceKey={s.key} label="手动运行" />
                      <Link
                        className="text-xs text-blue-600 underline dark:text-blue-400"
                        href={mergeAdminCandidateListUrl(new URLSearchParams(), {
                          sourceId: s.id,
                          page: "1",
                        })}
                      >
                        看候选（此来源）
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

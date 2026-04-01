import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { mergeAdminCandidateListUrl } from "@/lib/discovery/admin-candidate-list-url";
import { RunDiscoverySourceButton } from "../../run-discovery-source-button";

export const dynamic = "force-dynamic";

export default async function AdminDiscoverySourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const source = await prisma.discoverySource.findUnique({
    where: { id },
    include: {
      runs: {
        take: 50,
        orderBy: { startedAt: "desc" },
      },
    },
  });

  if (!source) {
    notFound();
  }

  const configStr = JSON.stringify(source.configJson ?? null, null, 2);

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery/sources" className="underline">
          ← 来源列表
        </Link>
      </p>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{source.name}</h1>
        <p className="mt-1 font-mono text-sm text-zinc-500">{source.key}</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {source.type}
          {source.subtype ? ` · ${source.subtype}` : ""} · 状态 {source.status}
        </p>
      </header>

      <div className="flex flex-wrap gap-3 text-sm">
        <RunDiscoverySourceButton sourceKey={source.key} label="手动运行此来源" />
        <Link
          className="rounded border border-zinc-300 px-3 py-1.5 text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
          href={mergeAdminCandidateListUrl(new URLSearchParams(), {
            sourceId: source.id,
            page: "1",
          })}
        >
          筛选候选池
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">configJson</h2>
        <pre className="mt-2 max-h-[320px] overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
          {configStr}
        </pre>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
          最近运行（最多 50 条）
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">id</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">开始</th>
                <th className="px-3 py-2">结束</th>
                <th className="px-3 py-2">f/p/+</th>
                <th className="px-3 py-2">错误</th>
              </tr>
            </thead>
            <tbody>
              {source.runs.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="max-w-[100px] truncate px-3 py-2 font-mono text-[10px] text-zinc-500">
                    {r.id}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {r.startedAt.toISOString().slice(0, 19)}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {r.finishedAt?.toISOString().slice(0, 19) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-zinc-600">
                    {r.fetchedCount}/{r.parsedCount}/+{r.newCandidateCount}/~
                    {r.updatedCandidateCount}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-[10px] text-amber-800 dark:text-amber-200">
                    {r.errorMessage ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {source.runs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">尚无运行记录。</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

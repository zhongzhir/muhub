import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureDiscoveryDefaultSources } from "@/lib/discovery/seed-default-sources";
import { mergeAdminCandidateListUrl } from "@/lib/discovery/admin-candidate-list-url";
import { fetchSourceYieldStats, sourceMatchesScopeFilter } from "@/lib/discovery/source-network/source-yield";
import {
  parseSourceKind,
  parseSourceOwner,
  sourceUrlFromConfig,
} from "@/lib/discovery/source-network/source-kinds";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import { RunDiscoverySourceButton } from "../run-discovery-source-button";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminDiscoverySourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await ensureDiscoveryDefaultSources();
  const sp = await searchParams;
  const scopeFilter = typeof sp.scope === "string" ? sp.scope : "publishing_ai";

  const allSources = await prisma.discoverySource.findMany({
    orderBy: { key: "asc" },
  });

  const sources = allSources.filter((s) =>
    scopeFilter === "all" ? true : sourceMatchesScopeFilter(s.configJson, scopeFilter),
  );

  const yieldMap = await fetchSourceYieldStats(
    prisma,
    sources.map((s) => s.id),
  );

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery" className="underline">
          ← 候选列表
        </Link>
      </p>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Source Network · 信息源网络</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            人工维护高质量信息源，AI 负责发现、抓取、过滤与转候选。不人工维护项目库。
          </p>
        </div>
        <Link
          href="/admin/discovery/sources/new"
          className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
        >
          + 新增来源
        </Link>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { label: "publishing_ai", value: "publishing_ai" },
          { label: "全部", value: "all" },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/discovery/sources?scope=${tab.value}`}
            className={`rounded-full px-3 py-1 ${
              scopeFilter === tab.value
                ? "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">名称 / key</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">Source Yield</th>
              <th className="px-3 py-2">最近 Run</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => {
              const yieldStats = yieldMap.get(s.id);
              const run = yieldStats?.lastRun;
              const kind = parseSourceKind(s.configJson);
              const owner = parseSourceOwner(s.configJson);
              const url = sourceUrlFromConfig(s.configJson);
              const scopes = parseScopesFromConfigJson(s.configJson);

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
                    {url ? (
                      <div className="mt-1 max-w-xs truncate text-[10px] text-zinc-400" title={url}>
                        {url}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {kind}
                    <div className="text-[10px] text-zinc-500">{owner}</div>
                    <div className="text-[10px] text-zinc-400">{scopes.join(", ")}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{s.status}</td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-zinc-600">
                    <div>Signals {yieldStats?.signalCount ?? 0}</div>
                    <div>Candidates {yieldStats?.candidateCount ?? 0}</div>
                  </td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-zinc-600">
                    {run ? (
                      <>
                        <div>{run.startedAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</div>
                        <div>
                          {run.status} · f{run.fetchedCount}/p{run.parsedCount}/+{run.newCandidateCount}
                        </div>
                        {run.errorMessage ? (
                          <div className="mt-1 line-clamp-2 text-amber-700 dark:text-amber-300" title={run.errorMessage}>
                            {run.errorMessage}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      "无记录"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <RunDiscoverySourceButton sourceKey={s.key} label="运行" />
                      <Link
                        className="text-xs text-blue-600 underline dark:text-blue-400"
                        href={mergeAdminCandidateListUrl(new URLSearchParams(), {
                          sourceId: s.id,
                          page: "1",
                        })}
                      >
                        候选
                      </Link>
                      <Link
                        href={`/admin/discovery/signals?sourceId=${s.id}`}
                        className="text-xs text-blue-600 underline dark:text-blue-400"
                      >
                        线索
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

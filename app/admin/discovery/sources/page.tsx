import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureDiscoveryDefaultSources } from "@/lib/discovery/seed-default-sources";
import { mergeAdminCandidateListUrl } from "@/lib/discovery/admin-candidate-list-url";
import { fetchSourceYieldStats, sourceMatchesScopeFilter } from "@/lib/discovery/source-network/source-yield";
import {
  isDiscoverySourceHiddenByDefault,
  isDiscoverySourceRunnable,
} from "@/lib/discovery/source-network/source-lifecycle";
import {
  parseSourceKind,
  parseSourceOwner,
  sourceUrlFromConfig,
} from "@/lib/discovery/source-network/source-kinds";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import { RunDiscoverySourceButton } from "../run-discovery-source-button";
import { DiscoveryHubNav } from "../discovery-hub-nav";

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
  const showInactive = sp.showInactive === "1" || sp.showInactive === "true";

  const allSources = await prisma.discoverySource.findMany({
    orderBy: { key: "asc" },
  });

  const sources = allSources.filter((s) => {
    if (!showInactive && isDiscoverySourceHiddenByDefault(s.status)) {
      return false;
    }
    return scopeFilter === "all" ? true : sourceMatchesScopeFilter(s.configJson, scopeFilter);
  });

  const yieldMap = await fetchSourceYieldStats(
    prisma,
    sources.map((s) => s.id),
  );

  return (
    <div className="space-y-8">
      <DiscoveryHubNav current="sources" />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Source Network · 信息源</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            <strong>感知层第一步：</strong>人工维护高质量 RSS、官网名单、协会公告等来源；系统跑 Source 后产出
            Signal 或 Candidate。不人工维护项目库。
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            publishing_ai 来源请在 config 中标注 scope；跑完后到{" "}
            <Link href="/admin/discovery/signals" className="underline">
              线索池
            </Link>{" "}
            或{" "}
            <Link href="/admin/discovery" className="underline">
              候选项目
            </Link>{" "}
            查看产出。
          </p>
        </div>
        <Link
          href="/admin/discovery/sources/new"
          className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white"
        >
          + 新增来源
        </Link>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "publishing_ai", value: "publishing_ai" },
            { label: "全部", value: "all" },
          ].map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/discovery/sources?scope=${tab.value}${showInactive ? "&showInactive=1" : ""}`}
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
        <Link
          href={`/admin/discovery/sources?scope=${scopeFilter}${showInactive ? "" : "&showInactive=1"}`}
          className={`rounded-full border px-3 py-1 text-xs ${
            showInactive
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          }`}
        >
          {showInactive ? "隐藏已停用" : "显示已停用"}
        </Link>
        {!showInactive ? (
          <span className="text-xs text-zinc-500">
            默认隐藏 DISABLED / ARCHIVED 来源
          </span>
        ) : null}
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
            {sources.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-zinc-500">
                  {showInactive
                    ? "暂无来源。"
                    : "暂无可见来源。重复或已停用来源可点「显示已停用」查看。"}
                </td>
              </tr>
            ) : (
            sources.map((s) => {
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
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={
                        s.status === "ARCHIVED" || s.status === "DISABLED"
                          ? "text-rose-700 dark:text-rose-300"
                          : undefined
                      }
                    >
                      {s.status}
                    </span>
                  </td>
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
                      <RunDiscoverySourceButton
                        sourceKey={s.key}
                        label="运行"
                        runnable={isDiscoverySourceRunnable(s.status)}
                        blockedReason={
                          isDiscoverySourceRunnable(s.status)
                            ? undefined
                            : `status=${s.status}，不可运行`
                        }
                      />
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
            })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { mergeAdminCandidateListUrl } from "@/lib/discovery/admin-candidate-list-url";
import { fetchSourceYieldStats } from "@/lib/discovery/source-network/source-yield";
import {
  parseSourceKind,
  parseSourceOwner,
  sourceUrlFromConfig,
} from "@/lib/discovery/source-network/source-kinds";
import { parseScopesFromConfigJson } from "@/lib/discovery/scope-from-config";
import { parseWebsiteScanConfig } from "@/lib/discovery/website-scan/parse-config";
import { RunDiscoverySourceButton } from "../../run-discovery-source-button";
import { DiscoverySourceForm } from "../source-form";
import { CopyAsWebsiteScanButton } from "../copy-as-website-scan-button";
import { DeactivateSourceButton } from "../deactivate-source-button";
import { isDiscoverySourceRunnable } from "@/lib/discovery/source-network/source-lifecycle";

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

  const yieldStats = (await fetchSourceYieldStats(prisma, [source.id])).get(source.id);
  const configStr = JSON.stringify(source.configJson ?? null, null, 2);
  const cfg = source.configJson as Record<string, unknown> | null;
  const topics = Array.isArray(cfg?.topics) ? (cfg!.topics as string[]).join(", ") : "";
  const scanConfig = parseWebsiteScanConfig(source.configJson, source.key);
  const lastRun = source.runs[0];
  const isWebsiteScan = scanConfig !== null;
  const sourceKind = parseSourceKind(source.configJson);
  const isLegacyWebsite = sourceKind === "WEBSITE";

  type WebsiteScanSummary = {
    fetchedPages?: number;
    matchedPages?: number;
    newSignals?: number;
    updatedSignals?: number;
    errors?: number;
  };
  let scanSummary: WebsiteScanSummary | null = null;
  if (isWebsiteScan && lastRun?.logJson && Array.isArray(lastRun.logJson)) {
    const summaryLine = (lastRun.logJson as string[]).find((l) =>
      l.includes("website_scan summary"),
    );
    if (summaryLine) {
      const jsonPart = summaryLine.split("website_scan summary ").at(1);
      if (jsonPart) {
        try {
          scanSummary = JSON.parse(jsonPart) as WebsiteScanSummary;
        } catch {
          scanSummary = null;
        }
      }
    }
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery/sources" className="underline">
          ← 来源网络
        </Link>
      </p>

      {isLegacyWebsite ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          该来源为旧 WEBSITE 类型。对于门户/内容网站，建议复制为 WEBSITE_SCAN 来源，避免直接修改类型导致 configJson 不兼容。
        </div>
      ) : null}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{source.name}</h1>
        <p className="mt-1 font-mono text-sm text-zinc-500">{source.key}</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {parseSourceKind(source.configJson)} · {parseSourceOwner(source.configJson)} ·{" "}
          {parseScopesFromConfigJson(source.configJson).join(", ")} · 状态 {source.status}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <div className="text-xs text-zinc-500">累计 Signals</div>
          <div className="text-xl font-semibold">{yieldStats?.signalCount ?? 0}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <div className="text-xs text-zinc-500">
            {isWebsiteScan ? "最近扫描匹配页" : "累计 Candidates"}
          </div>
          <div className="text-xl font-semibold">
            {isWebsiteScan ? (scanSummary?.matchedPages ?? lastRun?.parsedCount ?? 0) : (yieldStats?.candidateCount ?? 0)}
          </div>
        </div>
        {isWebsiteScan ? (
          <>
            <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="text-xs text-zinc-500">最近抓取页数</div>
              <div className="text-xl font-semibold">
                {scanSummary?.fetchedPages ?? lastRun?.fetchedCount ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="text-xs text-zinc-500">最近新 Signal</div>
              <div className="text-xl font-semibold">
                {scanSummary?.newSignals ?? lastRun?.newCandidateCount ?? 0}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800 sm:col-span-2">
            <div className="text-xs text-zinc-500">最近错误</div>
            <div className="text-xs text-amber-800 dark:text-amber-200">
              {source.lastErrorMessage ?? yieldStats?.lastRun?.errorMessage ?? "—"}
            </div>
          </div>
        )}

      </section>

      {isWebsiteScan ? (
        <p className="text-xs text-zinc-500">
          WEBSITE_SCAN：fetched=抓取 HTML 页数；matched=命中关键词并写入 Signal；+new=新 Signal。扫描错误见下方运行日志。
        </p>
      ) : null}

      {isWebsiteScan && (source.lastErrorMessage || (scanSummary?.errors ?? 0) > 0) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          最近扫描错误：{source.lastErrorMessage ?? `${scanSummary?.errors ?? 0} 条（见运行日志）`}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <RunDiscoverySourceButton
          sourceKey={source.key}
          label="手动运行此来源"
          runnable={isDiscoverySourceRunnable(source.status)}
          blockedReason={
            isDiscoverySourceRunnable(source.status)
              ? undefined
              : `来源 status=${source.status}，已停用或不可运行`
          }
        />
        {isLegacyWebsite ? <CopyAsWebsiteScanButton sourceId={source.id} /> : null}
        <Link
          className="rounded border border-zinc-300 px-3 py-1.5 text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
          href={mergeAdminCandidateListUrl(new URLSearchParams(), {
            sourceId: source.id,
            page: "1",
          })}
        >
          筛选候选池
        </Link>
        <Link
          href={`/admin/discovery/signals?sourceId=${source.id}&sourceKey=${encodeURIComponent(source.key)}`}
          className="rounded border border-zinc-300 px-3 py-1.5 text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
        >
          查看线索
        </Link>
      </div>

      <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 dark:border-rose-900 dark:bg-rose-950/20">
        <h2 className="text-sm font-semibold text-rose-900 dark:text-rose-100">停用 / 归档</h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          用于处理重复录入的信息源。不会删除历史 Signal、Candidate、Entity Hint 或运行日志，仅停止后续抓取。
        </p>
        <div className="mt-3">
          <DeactivateSourceButton
            sourceId={source.id}
            sourceName={source.name}
            status={source.status}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">编辑来源</h2>
        <DiscoverySourceForm
          mode="edit"
          sourceId={source.id}
          initial={{
            name: source.name,
            url: sourceUrlFromConfig(source.configJson) ?? "",
            sourceKind: parseSourceKind(source.configJson),
            status: source.status,
            sourceOwner: parseSourceOwner(source.configJson),
            notes: source.notes,
            topics,
            allowedDomains: scanConfig?.allowedDomains.join(", "),
            maxDepth: scanConfig ? String(scanConfig.maxDepth) : undefined,
            maxPages: scanConfig ? String(scanConfig.maxPages) : undefined,
            includeKeywords: scanConfig?.includeKeywords.join(", "),
            excludePatterns: scanConfig?.excludePatterns.join(", "),
          }}
        />
      </section>

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
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">开始</th>
                <th className="px-3 py-2">f/p/+</th>
                <th className="px-3 py-2">{isWebsiteScan ? "说明" : "错误"}</th>
              </tr>
            </thead>
            <tbody>
              {source.runs.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {r.startedAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}
                  </td>
                  <td className="px-3 py-2 text-[10px] tabular-nums text-zinc-600">
                    {r.fetchedCount}/{r.parsedCount}/+{r.newCandidateCount}
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-[10px] text-amber-800 dark:text-amber-200">
                    {isWebsiteScan
                      ? `抓取/匹配/新Signal ${r.fetchedCount}/${r.parsedCount}/+${r.newCandidateCount}`
                      : (r.errorMessage ?? "—")}
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

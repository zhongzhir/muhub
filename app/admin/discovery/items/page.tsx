import Link from "next/link";

import { readDiscoveryItems } from "@/agents/discovery/discovery-store";
import { readDiscoveryRuntimeState } from "@/agents/discovery/discovery-runtime-store";
import { GITHUB_DISCOVERY_KEYWORDS } from "@/agents/discovery/github/github-discovery-keywords";
import { discoverySchedulerConfig } from "@/agents/discovery/scheduler/discovery-scheduler-config";

import { DiscoveryRunActions } from "./discovery-run-actions";
import { DiscoveryJsonQueueTable } from "./discovery-json-queue-table";

export const dynamic = "force-dynamic";

export default async function AdminDiscoveryJsonQueuePage() {
  const items = await readDiscoveryItems();
  const runtime = await readDiscoveryRuntimeState();
  const githubV3 = discoverySchedulerConfig.githubV3;
  const totalKeywords = GITHUB_DISCOVERY_KEYWORDS.length;
  const batchSize = Math.min(totalKeywords, Math.max(1, githubV3.maxKeywordsPerRun));
  const cursor = totalKeywords > 0 ? runtime.githubV3KeywordCursor % totalKeywords : 0;
  const cursorEnd = totalKeywords > 0 ? (cursor + batchSize - 1) % totalKeywords : 0;
  const hasGithubToken = Boolean(
    process.env.GITHUB_TOKEN?.trim() || process.env.GITHUB_ACCESS_TOKEN?.trim(),
  );

  const sourceCounts = items.reduce<Record<string, number>>((acc, item) => {
    const sourceFromMeta =
      typeof item.meta?.source === "string" && item.meta.source.trim()
        ? item.meta.source.trim()
        : item.sourceType;
    acc[sourceFromMeta] = (acc[sourceFromMeta] ?? 0) + 1;
    return acc;
  }, {});
  const topSourceCounts = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/admin/discovery" className="underline-offset-4 hover:underline">
            ← Discovery 候选池（数据库）
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Discovery 队列（JSON · 基础版）</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          本地 <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">data/discovery-items.json</code>{" "}
          队列，用于最小闭环与后续导入衔接；本页不接 GitHub API、无自动抓取。
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Discovery 运行状态</h2>
          <DiscoveryRunActions />
        </div>
        <div className="mt-3 grid gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
          <p>GitHub V3: {githubV3.enabled ? "Enabled" : "Disabled"}</p>
          <p>maxKeywordsPerRun: {githubV3.maxKeywordsPerRun}</p>
          <p>intents: {githubV3.intents.join(", ")}</p>
          <p>Topic Discovery: {githubV3.enableTopicDiscovery ? "Enabled" : "Disabled"}</p>
          <p>Related Discovery: {githubV3.enableRelatedDiscovery ? "Enabled" : "Disabled"}</p>
          <p>searchDelayMs: {githubV3.searchDelayMs}</p>
          <p>GitHub token: {hasGithubToken ? "configured" : "missing"}</p>
          <p>keyword cursor: {cursor}</p>
          <p>total keywords: {totalKeywords}</p>
          <p>next batch size: {batchSize}</p>
          <p>next run range: {totalKeywords > 0 ? `${cursor} ~ ${cursorEnd}` : "-"}</p>
        </div>
        {topSourceCounts.length > 0 ? (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            source 计数（当前页数据）：{" "}
            {topSourceCounts.map(([source, count]) => `${source}: ${count}`).join(" | ")}
          </p>
        ) : null}
      </section>

      <DiscoveryJsonQueueTable items={items} />
    </div>
  );
}

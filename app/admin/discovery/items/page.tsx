import Link from "next/link";

import { readDiscoveryItems } from "@/agents/discovery/discovery-store";
import {
  readDiscoveryRunHistory,
  type DiscoveryRunHistoryGitHubV3Entry,
} from "@/agents/discovery/discovery-run-history-store";
import { readDiscoveryRuntimeState } from "@/agents/discovery/discovery-runtime-store";
import { GITHUB_DISCOVERY_KEYWORDS } from "@/agents/discovery/github/github-discovery-keywords";
import { discoverySchedulerConfig } from "@/agents/discovery/scheduler/discovery-scheduler-config";
import { readLatestWechatOutput, readLatestXOutputs } from "@/lib/admin/content-output-reader";

import { DiscoveryRunActions } from "./discovery-run-actions";
import { DiscoveryRecentRuns } from "./discovery-recent-runs";
import { DiscoveryJsonQueueTable } from "./discovery-json-queue-table";
import { ProjectActivityRunActions } from "./project-activity-run-actions";
import { ContentPipelineRunActions } from "./content-pipeline-run-actions";
import { ContentOutputsPanel } from "./content-outputs-panel";

export const dynamic = "force-dynamic";

export default async function AdminDiscoveryJsonQueuePage() {
  const items = await readDiscoveryItems();
  const runtime = await readDiscoveryRuntimeState();
  const runHistory = await readDiscoveryRunHistory();
  const recentRuns: DiscoveryRunHistoryGitHubV3Entry[] = runHistory
    .filter((e): e is DiscoveryRunHistoryGitHubV3Entry => e.type === "github-v3")
    .slice(-5)
    .reverse();
  const githubV3 = discoverySchedulerConfig.githubV3;
  const wechatDraft = await readLatestWechatOutput();
  const xDrafts = await readLatestXOutputs(5);
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
            ← 项目发现候选池（数据库）
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">项目发现队列（JSON · 基础版）</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          本地 <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-800">data/discovery-items.json</code>{" "}
          队列，用于最小闭环与后续导入衔接；本页不接 GitHub API、无自动抓取。
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">项目发现运行状态</h2>
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">运营工具</p>
            <div className="flex flex-wrap items-start gap-2">
              <DiscoveryRunActions />
              <ProjectActivityRunActions />
              <ContentPipelineRunActions />
            </div>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:grid-cols-2 lg:grid-cols-3">
          <p>GitHub 获取：{githubV3.enabled ? "已启用" : "已停用"}</p>
          <p>每次关键词数：{githubV3.maxKeywordsPerRun}</p>
          <p>发现意图：{githubV3.intents.join(", ")}</p>
          <p>主题发现：{githubV3.enableTopicDiscovery ? "已启用" : "已停用"}</p>
          <p>关联扩展：{githubV3.enableRelatedDiscovery ? "已启用" : "已停用"}</p>
          <p>GitHub 凭证：{hasGithubToken ? "已配置" : "未配置"}</p>
          <p>关键词总量：{totalKeywords}</p>
          <p>下次批量规模：{batchSize}</p>
        </div>
        <details className="mt-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
          <summary className="cursor-pointer font-medium">系统调试信息</summary>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <p>searchDelayMs: {githubV3.searchDelayMs}</p>
            <p>keyword cursor: {cursor}</p>
            <p>next run range: {totalKeywords > 0 ? `${cursor} ~ ${cursorEnd}` : "-"}</p>
          </div>
        </details>
        {topSourceCounts.length > 0 ? (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            source 计数（当前页数据）：{" "}
            {topSourceCounts.map(([source, count]) => `${source}: ${count}`).join(" | ")}
          </p>
        ) : null}
      </section>

      <ContentOutputsPanel wechatDraft={wechatDraft} xDrafts={xDrafts} />

      <DiscoveryRecentRuns entries={recentRuns} />

      <DiscoveryJsonQueueTable items={items} />
    </div>
  );
}

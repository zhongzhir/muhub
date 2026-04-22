import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeReferenceSources } from "@/lib/discovery/reference-sources";
import { getDiscoverySignalPriority } from "@/lib/discovery/signal-priority";
import { getDiscoverySignalSourceStats } from "@/lib/discovery/signal-source-stats";
import { prisma } from "@/lib/prisma";
import { SignalDetailActions } from "./signal-detail-actions";
import { SignalAiInsightPanel } from "./signal-ai-insight-panel";

export const dynamic = "force-dynamic";

export default async function AdminDiscoverySignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.discoverySignal.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      summary: true,
      url: true,
      sourceType: true,
      sourceName: true,
      signalType: true,
      rawText: true,
      referenceSources: true,
      guessedProjectName: true,
      guessedWebsiteUrl: true,
      guessedGithubUrl: true,
      status: true,
      reviewNote: true,
      convertedCandidateId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) {
    notFound();
  }
  const references = normalizeReferenceSources(row.referenceSources);
  const sourceStats = getDiscoverySignalSourceStats(row.referenceSources);
  const priority = getDiscoverySignalPriority({
    sourceType: row.sourceType,
    title: row.title,
    summary: row.summary,
    guessedProjectName: row.guessedProjectName,
    guessedWebsiteUrl: row.guessedWebsiteUrl,
    guessedGithubUrl: row.guessedGithubUrl,
    referenceSources: row.referenceSources,
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery/signals" className="underline">
          ← 线索池
        </Link>
      </p>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{row.title}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {row.sourceType} · {row.sourceName} · {row.status}
        </p>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          线索优先级：
          <span className="ml-2 inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
            {priority.priority}
          </span>
          <span className="ml-2 text-xs text-zinc-500">{priority.note}</span>
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          来源统计：{sourceStats.summaryText}（共 {sourceStats.total} 条）
          {sourceStats.isMultiSource ? "，该项目被多个来源提及，建议优先关注。" : ""}
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">线索内容</h2>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{row.summary || "—"}</p>
        <a
          href={row.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm text-blue-600 underline dark:text-blue-400"
        >
          打开原文链接
        </a>
        {row.rawText ? (
          <pre className="mt-3 max-h-56 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-100">
            {row.rawText}
          </pre>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">参考资料</h2>
        {references.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">暂无参考资料。</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {references.map((item, idx) => (
              <li key={`${item.url}-${idx}`}>
                <span className="text-xs text-zinc-500">{item.type}</span>
                {" · "}
                <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-600 underline dark:text-blue-400">
                  {item.title || item.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">推断信息</h2>
        <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          <li>guessedProjectName: {row.guessedProjectName || "—"}</li>
          <li>guessedWebsiteUrl: {row.guessedWebsiteUrl || "—"}</li>
          <li>guessedGithubUrl: {row.guessedGithubUrl || "—"}</li>
          <li>signalType: {row.signalType}</li>
          <li>convertedCandidateId: {row.convertedCandidateId || "—"}</li>
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">AI 辅助分析</h2>
        <div className="mt-3">
          <SignalAiInsightPanel signalId={row.id} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">操作</h2>
        <div className="mt-3">
          <SignalDetailActions signalId={row.id} status={row.status} />
        </div>
      </section>
    </div>
  );
}

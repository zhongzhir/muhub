import type { DiscoveryRunHistoryGitHubV3Entry } from "@/agents/discovery/discovery-run-history-store";

function topKeywords(entry: DiscoveryRunHistoryGitHubV3Entry, n: number): [string, number][] {
  return Object.entries(entry.byKeyword ?? {})
    .map(([kw, s]) => [kw, s.inserted] as [string, number])
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function topFilterReasons(entry: DiscoveryRunHistoryGitHubV3Entry, n: number): [string, number][] {
  return Object.entries(entry.filterReasons ?? {})
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString("zh-CN", { hour12: false });
}

type Props = {
  entries: DiscoveryRunHistoryGitHubV3Entry[];
};

export function DiscoveryRecentRuns({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">最近执行记录</h2>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          暂无记录。完成一次 GitHub V3 运行后会自动写入{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-[11px] dark:bg-zinc-800">
            data/discovery-run-history.json
          </code>
          （最多保留 20 条）。
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">最近执行记录</h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        展示至多 5 次 GitHub V3 运行摘要（新→旧）。磁盘上最多保留 20 条，见{" "}
        <code className="rounded bg-zinc-100 px-1 font-mono text-[11px] dark:bg-zinc-800">
          data/discovery-run-history.json
        </code>
        。
      </p>
      <ul className="mt-3 space-y-3">
        {entries.map((entry) => {
          const kwTop = topKeywords(entry, 3);
          const frTop = topFilterReasons(entry, 3);
          return (
            <li
              key={entry.id}
              className="rounded-md border border-zinc-100 bg-zinc-50/80 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/40"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-zinc-800 dark:text-zinc-100">{entry.type}</span>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{entry.id.slice(0, 8)}…</span>
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-500 dark:text-zinc-500">开始</span> {formatWhen(entry.startedAt)}
                {" · "}
                <span className="text-zinc-500 dark:text-zinc-500">结束</span> {formatWhen(entry.finishedAt)}
              </p>
              <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                <p>
                  <span className="text-zinc-500 dark:text-zinc-500">inserted / skipped / filtered</span>
                  <br />
                  <span className="font-mono text-zinc-800 dark:text-zinc-100">
                    {entry.inserted} / {entry.skipped} / {entry.filtered}
                  </span>
                  {entry.invalid > 0 ? (
                    <span className="text-zinc-500 dark:text-zinc-500"> · invalid {entry.invalid}</span>
                  ) : null}
                </p>
                <p>
                  <span className="text-zinc-500 dark:text-zinc-500">keywords / topics / related seeds</span>
                  <br />
                  <span className="font-mono text-zinc-800 dark:text-zinc-100">
                    {entry.keywordsProcessed} / {entry.topicsProcessed} / {entry.relatedSeedsProcessed}
                  </span>
                </p>
                <p>
                  <span className="text-zinc-500 dark:text-zinc-500">keyword cursor</span>
                  <br />
                  <span className="font-mono text-zinc-800 dark:text-zinc-100">
                    {entry.keywordCursorStart} → {entry.nextKeywordCursor}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-500"> · total KW {entry.totalKeywords}</span>
                </p>
              </div>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                <span className="text-zinc-500 dark:text-zinc-500">intents</span> {entry.intentsUsed.join(", ")}
              </p>
              {(entry.failedKeywords.length > 0 || entry.failedTopics.length > 0) && (
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  failedKeywords: {entry.failedKeywords.length} · failedTopics: {entry.failedTopics.length}
                </p>
              )}
              {kwTop.length > 0 ? (
                <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-500">Top keywords（按 inserted）</p>
                  <ul className="mt-0.5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                    {kwTop.map(([k, c]) => (
                      <li key={k}>
                        {k} ({c})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {frTop.length > 0 ? (
                <div className="mt-2 border-t border-zinc-200 pt-2 dark:border-zinc-800">
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-500">Top filter reasons</p>
                  <ul className="mt-0.5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                    {frTop.map(([r, c]) => (
                      <li key={r}>
                        {r} ({c})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

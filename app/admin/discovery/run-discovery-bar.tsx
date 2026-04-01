"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runDiscoverySourceAction } from "./actions";

export function RunDiscoveryBar() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const run = (sourceKey: string) => {
    setMessage(null);
    start(async () => {
      const r = await runDiscoverySourceAction(sourceKey);
      if (r.ok) {
        setMessage(
          `完成：run=${r.runId} 新建 ${r.newCandidateCount} / 更新 ${r.updatedCandidateCount}（抓取 ${r.fetchedCount} 条原始）`,
        );
        router.refresh();
      } else {
        setMessage(`失败：${r.error}`);
      }
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">手动抓取</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run("github-topics")}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          GitHub Topics
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("github-trending")}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200"
        >
          GitHub Trending
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("producthunt-featured")}
          className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-950 disabled:opacity-50 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-100"
        >
          Product Hunt 榜单
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("producthunt-ai")}
          className="rounded-lg border border-orange-300 px-3 py-2 text-xs font-medium text-orange-900 disabled:opacity-50 dark:border-orange-800 dark:text-orange-200"
        >
          Product Hunt AI
        </button>
      </div>
      {message ? (
        <p className="mt-3 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">{message}</p>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { syncChineseIndependentDeveloperAction } from "./actions";

const btn =
  "rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

export function SyncChineseIndieButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(dryRun: boolean) {
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const result = await syncChineseIndependentDeveloperAction({ dryRun });
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        const s = result.summary;
        setMessage(
          `${dryRun ? "预检" : "同步"}完成：解析 ${s.parsed}，可入队 ${s.queued}，重复 ${s.duplicates.length}，跳过已关闭 ${s.skippedClosed}${s.imported ? `，已导入 ${s.imported}` : ""}`,
        );
        router.refresh();
      })();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={btn} onClick={() => run(true)}>
          {pending ? "处理中..." : "预检中国独立开发者库"}
        </button>
        <button type="button" disabled={pending} className={btn} onClick={() => run(false)}>
          {pending ? "处理中..." : "同步中国独立开发者库"}
        </button>
      </div>
      {message ? <p className="max-w-xl text-[11px] text-zinc-500 dark:text-zinc-400">{message}</p> : null}
    </div>
  );
}

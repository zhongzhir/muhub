"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recomputeReviewPriorityBatchAction } from "./actions";

export function RecomputeReviewPriorityButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () => {
    setMsg(null);
    start(async () => {
      const r = await recomputeReviewPriorityBatchAction(280);
      if (r.ok) {
        setMsg(`已重算 ${r.updated} 条优先级`);
        router.refresh();
      } else {
        setMsg(`失败：${r.error}`);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="rounded-lg border border-violet-400 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 disabled:opacity-50 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100"
        title="对最早更新的 280 条候选重算审核优先级（历史数据迁移）"
      >
        重算审核优先级（批量）
      </button>
      {msg ? <span className="text-xs text-zinc-600 dark:text-zinc-400">{msg}</span> : null}
    </div>
  );
}

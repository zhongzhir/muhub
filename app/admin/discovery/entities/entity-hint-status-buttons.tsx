"use client";

import { useState, useTransition } from "react";
import { updateEntityHintStatusAction } from "./actions";

export function EntityHintStatusButtons({
  hintId,
  currentStatus,
}: {
  hintId: string;
  currentStatus: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(status: "ACCEPTED" | "REJECTED" | "MERGED_LATER") {
    startTransition(async () => {
      setMessage(null);
      const result = await updateEntityHintStatusAction(hintId, status);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("已记录判断");
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || currentStatus === "ACCEPTED"}
          onClick={() => run("ACCEPTED")}
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          接受
        </button>
        <button
          type="button"
          disabled={pending || currentStatus === "REJECTED"}
          onClick={() => run("REJECTED")}
          className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-800 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
        >
          拒绝
        </button>
        <button
          type="button"
          disabled={pending || currentStatus === "MERGED_LATER"}
          onClick={() => run("MERGED_LATER")}
          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 disabled:opacity-50 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          待合并
        </button>
      </div>
      {message ? <p className="text-xs text-zinc-500">{message}</p> : null}
    </div>
  );
}

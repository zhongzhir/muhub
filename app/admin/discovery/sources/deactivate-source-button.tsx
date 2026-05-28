"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deactivateDiscoverySourceAction } from "./actions";

export function DeactivateSourceButton({
  sourceId,
  sourceName,
  status,
}: {
  sourceId: string;
  sourceName: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alreadyInactive = status === "ARCHIVED" || status === "DISABLED";

  if (alreadyInactive) {
    return (
      <p className="text-xs text-zinc-500">
        来源已{status === "ARCHIVED" ? "归档" : "停用"}，不会参与后续抓取。
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          setMessage(null);
          setConfirmOpen(true);
        }}
        className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-900 disabled:opacity-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
      >
        删除 / 归档来源
      </button>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">确认停用「{sourceName}」？</h3>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-600 dark:text-zinc-400">
              <li>不会删除历史 Signal、Candidate、Entity Hint 或运行日志</li>
              <li>仅停止后续 pipeline / 手动运行</li>
              <li>若已有产出 → 标记为 <strong>ARCHIVED</strong></li>
              <li>若完全无产出 → 从来源列表物理删除</li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await deactivateDiscoverySourceAction(sourceId);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    setConfirmOpen(false);
                    if (result.action === "deleted") {
                      router.push("/admin/discovery/sources");
                      router.refresh();
                      return;
                    }
                    setMessage("已归档来源，后续不会被执行。");
                    router.refresh();
                  })
                }
                className="rounded bg-rose-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {pending ? "处理中…" : "确认停用"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
              >
                取消
              </button>
            </div>
            {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
          </div>
        </div>
      ) : null}

      {message ? <p className="text-xs text-emerald-700 dark:text-emerald-300">{message}</p> : null}
    </div>
  );
}

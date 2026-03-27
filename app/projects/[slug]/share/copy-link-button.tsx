"use client";

import { useCallback, useId, useState } from "react";
import { ManualCopyTextarea } from "@/components/share/manual-copy-textarea";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

export function CopyLinkButton() {
  const helperId = useId();
  const [phase, setPhase] = useState<"idle" | "copied" | "error">("idle");

  const onClick = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) {
      setPhase("error");
      return;
    }
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setPhase("copied");
      window.setTimeout(() => setPhase("idle"), 2500);
    } else {
      setPhase("error");
    }
  }, []);

  const label = phase === "copied" ? "已复制链接" : "复制分享链接";
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="flex w-full min-w-0 max-w-md flex-col items-stretch gap-2 sm:items-center">
      <button
        type="button"
        onClick={onClick}
        data-testid="copy-share-link"
        aria-describedby={phase === "copied" ? helperId : undefined}
        className="inline-flex w-full items-center justify-center rounded-xl bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:outline-zinc-500 sm:min-w-[200px]"
      >
        {label}
      </button>
      {phase === "copied" ? (
        <p
          id={helperId}
          role="status"
          className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-400"
        >
          已复制链接
        </p>
      ) : null}
      {phase === "error" ? (
        <div className="w-full min-w-0 px-0.5 sm:px-0" role="alert">
          <p className="text-center text-sm font-medium leading-snug text-amber-900 [overflow-wrap:anywhere] dark:text-amber-200">
            复制失败，请长按下方链接手动复制
          </p>
          {pageUrl ? <ManualCopyTextarea value={pageUrl} hint="名片页链接（可长按复制）" /> : null}
        </div>
      ) : null}
    </div>
  );
}

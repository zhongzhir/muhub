"use client";

import { useCallback, useId, useState } from "react";

export function CopyLinkButton() {
  const helperId = useId();
  const [phase, setPhase] = useState<"idle" | "copied" | "error">("idle");

  const onClick = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setPhase("copied");
      window.setTimeout(() => setPhase("idle"), 2500);
    } catch {
      setPhase("error");
      window.setTimeout(() => setPhase("idle"), 2500);
    }
  }, []);

  const label =
    phase === "copied" ? "已复制链接" : phase === "error" ? "复制失败，请重试" : "复制分享链接";

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-center">
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
        <p id={helperId} role="status" className="text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
          已复制链接
        </p>
      ) : null}
      {phase === "error" ? (
        <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
          请检查浏览器剪贴板权限后重试
        </p>
      ) : null}
    </div>
  );
}

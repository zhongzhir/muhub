"use client";

import { useCallback, useState } from "react";

export function CopyLinkButton() {
  const [label, setLabel] = useState("复制链接");

  const onClick = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setLabel("已复制");
      window.setTimeout(() => setLabel("复制链接"), 2000);
    } catch {
      setLabel("复制失败");
      window.setTimeout(() => setLabel("复制链接"), 2000);
    }
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="copy-share-link"
      className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:w-auto"
    >
      {label}
    </button>
  );
}

"use client";

import { useCallback, useState } from "react";
import { buildHomeShareClipboardText, buildHomeShareSocialLine, homeCanonicalUrl } from "@/lib/share/site-share";

const btnClass =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300/90 bg-white/90 px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800";

export function SiteShareActions() {
  const [copied, setCopied] = useState(false);
  const url = homeCanonicalUrl();
  const clipboardText = buildHomeShareClipboardText();
  const socialLine = buildHomeShareSocialLine();

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(clipboardText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [clipboardText]);

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(socialLine)}&url=${encodeURIComponent(url)}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <div className="mt-10 w-full max-w-lg border-t border-zinc-200/70 pt-8 dark:border-zinc-700/80">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">分享木哈布</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-center">
        <button type="button" className={btnClass} onClick={onCopy} data-testid="site-share-copy-home">
          {copied ? "已复制首页链接" : "复制首页链接"}
        </button>
        <a className={btnClass} href={xHref} target="_blank" rel="noopener noreferrer">
          在 X 分享
        </a>
        <a className={btnClass} href={linkedInHref} target="_blank" rel="noopener noreferrer">
          在 LinkedIn 分享
        </a>
      </div>
    </div>
  );
}

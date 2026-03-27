"use client";

import { useCallback, useState } from "react";

type Props = {
  canonicalUrl: string;
  /** 含项目名、摘要，不含 URL，用于 X 等 */
  shareSocialLine: string;
  /** 完整可复制块（多行，含 URL） */
  shareClipboardText: string;
};

const btnClass =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

export function ProjectShareActions({ canonicalUrl, shareSocialLine, shareClipboardText }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareClipboardText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [shareClipboardText]);

  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareSocialLine)}&url=${encodeURIComponent(canonicalUrl)}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonicalUrl)}`;

  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-white/80 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/50"
      data-testid="project-share-actions"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">分享传播</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnClass} onClick={onCopy}>
          {copied ? "已复制" : "复制链接"}
        </button>
        <a className={btnClass} href={xHref} target="_blank" rel="noopener noreferrer">
          在 X 分享
        </a>
        <a className={btnClass} href={linkedInHref} target="_blank" rel="noopener noreferrer">
          在 LinkedIn 分享
        </a>
        <a
          className={`${btnClass} border-dashed`}
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          打开正式链接
        </a>
      </div>
      <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        链接使用正式域名，便于微信等场景粘贴传播。
      </p>
    </div>
  );
}

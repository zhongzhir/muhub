"use client";

import { useCallback, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { buildWeiboShareUrl } from "@/lib/share/weibo";

type Props = {
  canonicalUrl: string;
  /** 微博标题/摘要（不含 URL，与微博分享习惯一致） */
  shareSocialLine: string;
  /** 完整可复制块（多行，含 URL） */
  shareClipboardText: string;
};

const btnClass =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

type CopyKind = "link" | "text";

export function ProjectShareActions({ canonicalUrl, shareSocialLine, shareClipboardText }: Props) {
  const weiboHref = buildWeiboShareUrl(canonicalUrl, shareSocialLine);
  const timers = useRef<{ link?: number; text?: number }>({});
  const [linkState, setLinkState] = useState<"base" | "ok" | "err">("base");
  const [textState, setTextState] = useState<"base" | "ok" | "err">("base");

  const scheduleReset = useCallback((kind: CopyKind) => {
    const key = kind === "link" ? "link" : "text";
    if (timers.current[key]) {
      window.clearTimeout(timers.current[key]);
    }
    timers.current[key] = window.setTimeout(() => {
      if (kind === "link") {
        setLinkState("base");
      } else {
        setTextState("base");
      }
    }, 2500);
  }, []);

  const onCopyLink = useCallback(async () => {
    const ok = await copyTextToClipboard(canonicalUrl);
    setLinkState(ok ? "ok" : "err");
    scheduleReset("link");
  }, [canonicalUrl, scheduleReset]);

  const onCopyText = useCallback(async () => {
    const ok = await copyTextToClipboard(shareClipboardText);
    setTextState(ok ? "ok" : "err");
    scheduleReset("text");
  }, [shareClipboardText, scheduleReset]);

  const linkLabel =
    linkState === "ok" ? "已复制链接" : linkState === "err" ? "复制失败，请手动复制" : "复制链接";
  const textLabel =
    textState === "ok"
      ? "已复制分享文案"
      : textState === "err"
        ? "复制失败，请手动复制"
        : "复制分享文案";

  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-white/80 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/50"
      data-testid="project-share-actions"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">分享传播</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnClass} onClick={onCopyLink} data-testid="project-share-copy-link">
          {linkLabel}
        </button>
        <button type="button" className={btnClass} onClick={onCopyText} data-testid="project-share-copy-text">
          {textLabel}
        </button>
        <a className={btnClass} href={weiboHref} target="_blank" rel="noopener noreferrer">
          分享到微博
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
        复制链接或完整文案后，可粘贴到微信会话、文档等；微博将新开页面填写发布内容。
      </p>
      {/* 二维码：后续可接入轻量方案，避免本轮引入不稳定依赖 */}
    </div>
  );
}

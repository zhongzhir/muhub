"use client";

import { useCallback, useRef, useState } from "react";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import {
  buildHomeShareClipboardText,
  buildHomeShareSocialLine,
  homeCanonicalUrl,
} from "@/lib/share/site-share";
import { buildWeiboShareUrl } from "@/lib/share/weibo";

const btnClass =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300/90 bg-white/90 px-3 py-2 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800";

type CopyKind = "link" | "text";

export function SiteShareActions() {
  const url = homeCanonicalUrl();
  const clipboardText = buildHomeShareClipboardText();
  const socialLine = buildHomeShareSocialLine();
  const weiboHref = buildWeiboShareUrl(url, socialLine);

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
    const ok = await copyTextToClipboard(url);
    setLinkState(ok ? "ok" : "err");
    scheduleReset("link");
  }, [url, scheduleReset]);

  const onCopyText = useCallback(async () => {
    const ok = await copyTextToClipboard(clipboardText);
    setTextState(ok ? "ok" : "err");
    scheduleReset("text");
  }, [clipboardText, scheduleReset]);

  const linkLabel =
    linkState === "ok" ? "已复制链接" : linkState === "err" ? "复制失败，请手动复制" : "复制链接";
  const textLabel =
    textState === "ok"
      ? "已复制分享文案"
      : textState === "err"
        ? "复制失败，请手动复制"
        : "复制分享文案";

  return (
    <div className="mt-10 w-full max-w-lg border-t border-zinc-200/70 pt-8 dark:border-zinc-700/80">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">分享木哈布</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-center">
        <button
          type="button"
          className={btnClass}
          onClick={onCopyLink}
          data-testid="site-share-copy-home"
        >
          {linkLabel}
        </button>
        <button type="button" className={btnClass} onClick={onCopyText} data-testid="site-share-copy-text">
          {textLabel}
        </button>
        <a className={btnClass} href={weiboHref} target="_blank" rel="noopener noreferrer">
          分享到微博
        </a>
      </div>
      {/* 二维码：网页端生成需额外依赖；稳定上线优先，后续可加 */}
    </div>
  );
}

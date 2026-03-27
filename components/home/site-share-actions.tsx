"use client";

import { useCallback, useRef, useState } from "react";
import { ManualCopyTextarea } from "@/components/share/manual-copy-textarea";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import {
  buildHomeShareClipboardText,
  buildHomeShareSocialLine,
  homeCanonicalUrl,
} from "@/lib/share/site-share";
import { buildWeiboShareUrl } from "@/lib/share/weibo";

const btnClass =
  "inline-flex min-h-[2.75rem] w-full max-w-full shrink-0 items-center justify-center rounded-lg border border-zinc-300/90 bg-white/90 px-3 py-2.5 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-100 sm:w-auto sm:min-h-0 sm:max-w-none sm:py-2 dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:bg-zinc-800";

type CopyKind = "link" | "text";

export function SiteShareActions() {
  const url = homeCanonicalUrl();
  const clipboardText = buildHomeShareClipboardText();
  const socialLine = buildHomeShareSocialLine();
  const weiboHref = buildWeiboShareUrl(url, socialLine);

  const timers = useRef<{ link?: number; text?: number }>({});
  const [linkState, setLinkState] = useState<"base" | "ok" | "err">("base");
  const [textState, setTextState] = useState<"base" | "ok" | "err">("base");

  const scheduleResetOk = useCallback((kind: CopyKind) => {
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
    setLinkState("base");
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setLinkState("ok");
      scheduleResetOk("link");
    } else {
      setLinkState("err");
    }
  }, [url, scheduleResetOk]);

  const onCopyText = useCallback(async () => {
    setTextState("base");
    const ok = await copyTextToClipboard(clipboardText);
    if (ok) {
      setTextState("ok");
      scheduleResetOk("text");
    } else {
      setTextState("err");
    }
  }, [clipboardText, scheduleResetOk]);

  const linkLabel = linkState === "ok" ? "已复制链接" : "复制链接";
  const textLabel = textState === "ok" ? "已复制分享文案" : "复制分享文案";

  return (
    <div className="mt-10 w-full max-w-lg border-t border-zinc-200/70 pt-8 dark:border-zinc-700/80">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">分享木哈布</p>
      <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
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

      <div className="mt-4 space-y-4">
        {linkState === "ok" ? (
          <p className="text-center text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            已复制链接
          </p>
        ) : null}
        {linkState === "err" ? (
          <div role="alert" className="min-w-0 px-0.5 sm:px-0">
            <p className="text-center text-xs font-medium leading-snug text-amber-900 [overflow-wrap:anywhere] dark:text-amber-200">
              复制失败，请长按下方链接手动复制
            </p>
            <ManualCopyTextarea value={url} hint="首页正式链接（可长按复制）" />
          </div>
        ) : null}

        {textState === "ok" ? (
          <p className="text-center text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            已复制分享文案
          </p>
        ) : null}
        {textState === "err" ? (
          <div role="alert" className="min-w-0 px-0.5 sm:px-0">
            <p className="text-center text-xs font-medium leading-snug text-amber-900 [overflow-wrap:anywhere] dark:text-amber-200">
              复制失败，请长按下方文本手动复制
            </p>
            <ManualCopyTextarea value={clipboardText} hint="分享文案（可长按复制）" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

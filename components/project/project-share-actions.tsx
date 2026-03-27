"use client";

import { useCallback, useRef, useState } from "react";
import { ManualCopyTextarea } from "@/components/share/manual-copy-textarea";
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
  "inline-flex min-h-[2.75rem] w-full max-w-full shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-xs font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 sm:w-auto sm:min-h-0 sm:max-w-none sm:py-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

type CopyKind = "link" | "text";

export function ProjectShareActions({ canonicalUrl, shareSocialLine, shareClipboardText }: Props) {
  const weiboHref = buildWeiboShareUrl(canonicalUrl, shareSocialLine);
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
    const ok = await copyTextToClipboard(canonicalUrl);
    if (ok) {
      setLinkState("ok");
      scheduleResetOk("link");
    } else {
      setLinkState("err");
    }
  }, [canonicalUrl, scheduleResetOk]);

  const onCopyText = useCallback(async () => {
    setTextState("base");
    const ok = await copyTextToClipboard(shareClipboardText);
    if (ok) {
      setTextState("ok");
      scheduleResetOk("text");
    } else {
      setTextState("err");
    }
  }, [shareClipboardText, scheduleResetOk]);

  const linkLabel = linkState === "ok" ? "已复制链接" : "复制链接";
  const textLabel = textState === "ok" ? "已复制分享文案" : "复制分享文案";

  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-200/90 bg-white/80 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-900/50"
      data-testid="project-share-actions"
    >
      <p className="text-xs font-medium tracking-wide text-zinc-500">分享与传播</p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
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

      <div className="space-y-4">
        {linkState === "ok" ? (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            已复制链接
          </p>
        ) : null}
        {linkState === "err" ? (
          <div role="alert" className="min-w-0">
            <p className="text-xs font-medium leading-snug text-amber-900 [overflow-wrap:anywhere] dark:text-amber-200">
              复制失败，请长按下方链接手动复制
            </p>
            <ManualCopyTextarea value={canonicalUrl} hint="项目正式链接（可长按复制）" />
          </div>
        ) : null}

        {textState === "ok" ? (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            已复制分享文案
          </p>
        ) : null}
        {textState === "err" ? (
          <div role="alert" className="min-w-0">
            <p className="text-xs font-medium leading-snug text-amber-900 [overflow-wrap:anywhere] dark:text-amber-200">
              复制失败，请长按下方文本手动复制
            </p>
            <ManualCopyTextarea value={shareClipboardText} hint="分享文案（可长按复制）" />
          </div>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500 [overflow-wrap:anywhere] dark:text-zinc-400">
        复制链接或完整文案后，可粘贴到微信会话、文档等；分享到微博将打开新页面填写内容。
      </p>
    </div>
  );
}

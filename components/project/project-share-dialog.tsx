"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ManualCopyTextarea } from "@/components/share/manual-copy-textarea";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

export type ProjectShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  tagline: string | undefined;
  /** 无 tagline 时的展示兜底（如 buildProjectShareSnippet） */
  shareSnippet: string;
  canonicalUrl: string;
  shareClipboardText: string;
};

const cardBtn =
  "inline-flex min-h-[2.5rem] w-full flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-center text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:w-auto";

export function ProjectShareDialog({
  open,
  onOpenChange,
  name,
  tagline,
  shareSnippet,
  canonicalUrl,
  shareClipboardText,
}: ProjectShareDialogProps) {
  const dialogTitleId = useId();
  const timers = useRef<{ link?: number; text?: number }>({});
  const [linkState, setLinkState] = useState<"base" | "ok" | "err">("base");
  const [textState, setTextState] = useState<"base" | "ok" | "err">("base");

  const scheduleResetOk = useCallback((kind: "link" | "text") => {
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

  const onCopyShareText = useCallback(async () => {
    setTextState("base");
    const ok = await copyTextToClipboard(shareClipboardText);
    if (ok) {
      setTextState("ok");
      scheduleResetOk("text");
    } else {
      setTextState("err");
    }
  }, [shareClipboardText, scheduleResetOk]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="关闭分享面板"
        className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[1px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        data-testid="project-share-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={dialogTitleId} className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            分享此项目
          </h3>
          <button
            type="button"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={() => onOpenChange(false)}
            aria-label="关闭"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{name}</p>
          {tagline?.trim() ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{tagline.trim()}</p>
          ) : shareSnippet ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{shareSnippet}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">暂无简介。</p>
          )}
          <p className="mt-3 break-all font-mono text-xs text-blue-600 dark:text-blue-400">{canonicalUrl}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" className={cardBtn} onClick={onCopyLink} data-testid="project-share-copy-link">
            {linkState === "ok" ? "已复制链接" : "复制链接"}
          </button>
          <button type="button" className={cardBtn} onClick={onCopyShareText} data-testid="project-share-copy-text">
            {textState === "ok" ? "已复制分享文案" : "复制分享文案"}
          </button>
          <button
            type="button"
            disabled
            title="即将推出"
            className="inline-flex min-h-[2.5rem] w-full cursor-not-allowed items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-400 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-500 sm:w-auto"
          >
            社媒分享（即将推出）
          </button>
        </div>

        {linkState === "ok" ? (
          <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            链接已复制
          </p>
        ) : null}
        {linkState === "err" ? (
          <div className="mt-3" role="alert">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              复制失败，请长按下方链接手动复制。
            </p>
            <div className="mt-2">
              <ManualCopyTextarea value={canonicalUrl} hint="项目公开链接" />
            </div>
          </div>
        ) : null}

        {textState === "ok" ? (
          <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            分享文案已复制
          </p>
        ) : null}
        {textState === "err" ? (
          <div className="mt-3" role="alert">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              复制失败，可长按下方文本手动复制。
            </p>
            <div className="mt-2">
              <ManualCopyTextarea value={shareClipboardText} hint="完整分享文案" />
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800/40">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">项目名片 / 海报</p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            后续将支持适合微信与各社媒传播的一页式名片与海报（占位说明）。
          </p>
          <button
            type="button"
            disabled
            className="mt-3 w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
          >
            生成项目名片（即将推出）
          </button>
        </div>
      </div>
    </div>
  );
}

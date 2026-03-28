"use client";

import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { ManualCopyTextarea } from "@/components/share/manual-copy-textarea";
import { ProjectShareCard } from "@/components/project/project-share-card";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import {
  incrementProjectShareLocalMetric,
  readProjectShareLocalMetrics,
  resolveProjectShareStorageId,
  totalShareActions,
} from "@/lib/share/project-share-local-metrics";
import {
  buildTwitterIntentUrl,
  buildTwitterShareText,
  getShareTextByTemplate,
  resolveCommunityDescriptionBody,
  type ShareTemplateId,
} from "@/lib/share/project-share-templates";

export type ProjectShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  name: string;
  tagline: string | undefined;
  /** 无 tagline 时的展示兜底 */
  shareSnippet: string;
  canonicalUrl: string;
  /** 项目介绍，用于「社群」模板正文 */
  description?: string;
};

const cardBtn =
  "inline-flex min-h-[2.5rem] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-center text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:min-w-0 sm:flex-1";

const twitterBtn =
  "inline-flex min-h-[2.5rem] w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-medium text-sky-900 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-950/60";

const templateLabels: Record<ShareTemplateId, string> = {
  short: "简短",
  community: "社群",
  twitter: "英文",
};

export function ProjectShareDialog({
  open,
  onOpenChange,
  slug,
  name,
  tagline,
  shareSnippet,
  canonicalUrl,
  description,
}: ProjectShareDialogProps) {
  const dialogTitleId = useId();
  const templateGroupId = useId();
  const previewCopyId = useId();
  const storageId = useMemo(() => resolveProjectShareStorageId(slug, canonicalUrl), [slug, canonicalUrl]);

  const [template, setTemplate] = useState<ShareTemplateId>("short");
  const timers = useRef<{ link?: number; text?: number }>({});
  const [linkState, setLinkState] = useState<"base" | "ok" | "err">("base");
  const [textState, setTextState] = useState<"base" | "ok" | "err">("base");
  const [, bumpMetricsRender] = useReducer((x: number) => x + 1, 0);

  /** 弹窗打开时每次渲染从 localStorage 重读，复制/Twitter 后随其它 setState 自然刷新 */
  const localShareTotals = open ? totalShareActions(readProjectShareLocalMetrics(storageId)) : 0;

  const descriptionLine = useMemo(
    () => resolveCommunityDescriptionBody(description, tagline, shareSnippet, name),
    [description, tagline, shareSnippet, name],
  );

  const cardSubtitle = useMemo(
    () => tagline?.trim() || shareSnippet.trim() || descriptionLine.slice(0, 160),
    [tagline, shareSnippet, descriptionLine],
  );

  const shareBody = useMemo(
    () => getShareTextByTemplate(template, { title: name, url: canonicalUrl, descriptionLine }),
    [template, name, canonicalUrl, descriptionLine],
  );

  const twitterIntentHref = useMemo(
    () => buildTwitterIntentUrl(buildTwitterShareText(name, canonicalUrl)),
    [name, canonicalUrl],
  );

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
    }, 2400);
  }, []);

  const onOpenChangeWrapped = useCallback(
    (next: boolean) => {
      if (!next) {
        if (timers.current.link) {
          window.clearTimeout(timers.current.link);
          timers.current.link = undefined;
        }
        if (timers.current.text) {
          window.clearTimeout(timers.current.text);
          timers.current.text = undefined;
        }
        setLinkState("base");
        setTextState("base");
        setTemplate("short");
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const onCopyLink = useCallback(async () => {
    setLinkState("base");
    setTextState("base");
    const ok = await copyTextToClipboard(canonicalUrl);
    if (ok) {
      setLinkState("ok");
      scheduleResetOk("link");
      incrementProjectShareLocalMetric(storageId, "copyLink");
    } else {
      setLinkState("err");
    }
  }, [canonicalUrl, scheduleResetOk, storageId]);

  const onCopyShareText = useCallback(async () => {
    setTextState("base");
    setLinkState("base");
    const ok = await copyTextToClipboard(shareBody);
    if (ok) {
      setTextState("ok");
      scheduleResetOk("text");
      incrementProjectShareLocalMetric(storageId, "copyText");
    } else {
      setTextState("err");
    }
  }, [shareBody, scheduleResetOk, storageId]);

  const onTwitterIntentClick = useCallback(() => {
    incrementProjectShareLocalMetric(storageId, "twitter");
    bumpMetricsRender();
  }, [storageId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChangeWrapped(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChangeWrapped]);

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

  useEffect(() => {
    if (!open) {
      return;
    }
    const timerBag = timers;
    return () => {
      const linkId = timerBag.current.link;
      const textId = timerBag.current.text;
      if (linkId) {
        window.clearTimeout(linkId);
        timerBag.current.link = undefined;
      }
      if (textId) {
        window.clearTimeout(textId);
        timerBag.current.text = undefined;
      }
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
        onClick={() => onOpenChangeWrapped(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        className="relative z-10 max-h-[min(92vh,40rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        data-testid="project-share-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id={dialogTitleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              分享项目
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">让更多人发现它</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            onClick={() => onOpenChangeWrapped(false)}
            aria-label="关闭"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">分享效果预览</p>
          <p className="mt-0.5 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
            你分享时，对方会看到类似这样的项目信息
          </p>
          <div className="mt-2">
            <ProjectShareCard name={name} subtitle={cardSubtitle} slug={slug} />
          </div>
        </div>

        <div className="mt-5">
          <p id={templateGroupId} className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            文案风格
          </p>
          <div
            className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/80"
            role="group"
            aria-labelledby={templateGroupId}
          >
            {(Object.keys(templateLabels) as ShareTemplateId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTemplate(id)}
                aria-pressed={template === id}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  template === id
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-900/80"
                }`}
              >
                {templateLabels[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <p id={previewCopyId} className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            当前将复制的文案
          </p>
          <div
            className="max-h-28 overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-50/90 dark:border-zinc-600 dark:bg-zinc-800/60"
            aria-labelledby={previewCopyId}
          >
            <pre className="max-h-28 overflow-y-auto whitespace-pre-wrap break-words p-3 text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-200">
              {shareBody}
            </pre>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" className={cardBtn} onClick={onCopyLink} data-testid="project-share-copy-link">
            {linkState === "ok" ? "已复制" : "复制链接"}
          </button>
          <button type="button" className={cardBtn} onClick={onCopyShareText} data-testid="project-share-copy-text">
            {textState === "ok" ? "已复制" : "复制文案"}
          </button>
        </div>

        <a
          href={twitterIntentHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${twitterBtn} mt-2`}
          data-testid="project-share-twitter"
          onClick={onTwitterIntentClick}
        >
          Twitter / X
        </a>
        <p className="mt-1 text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
          会用英文短句与项目链接打开发布页，可按需再改后发送。
        </p>

        {linkState === "ok" ? (
          <div className="mt-2 rounded-lg bg-emerald-50/80 px-2.5 py-2 dark:bg-emerald-950/25" role="status">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">链接已复制</p>
            <p className="mt-0.5 text-[11px] leading-snug text-emerald-800/85 dark:text-emerald-200/90">
              可以发到群聊、私信或你常用的社交平台。多分享几次，被看到的机会会更高。
            </p>
          </div>
        ) : null}

        {textState === "ok" ? (
          <div className="mt-2 rounded-lg bg-emerald-50/80 px-2.5 py-2 dark:bg-emerald-950/25" role="status">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">文案已复制</p>
            <p className="mt-0.5 text-[11px] leading-snug text-emerald-800/85 dark:text-emerald-200/90">
              粘贴后即可发给朋友或社群，按你的语气微调也很好。
            </p>
          </div>
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

        {textState === "err" ? (
          <div className="mt-3" role="alert">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              复制失败，可长按下方文本手动复制。
            </p>
            <div className="mt-2">
              <ManualCopyTextarea value={shareBody} hint="分享文案" />
            </div>
          </div>
        ) : null}

        <p className="mt-4 text-center text-[11px] leading-snug text-zinc-400 dark:text-zinc-500">
          {localShareTotals === 0 ? (
            <>这是你第一次在本设备上分享这个项目。</>
          ) : (
            <>
              本设备上已累计 <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{localShareTotals}</span>{" "}
              次分享操作（复制链接、复制文案或打开 Twitter）。
            </>
          )}
        </p>

        <div className="mt-6 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800/40">
          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">项目名片 / 海报</p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            后续将支持更适合微信与社媒传播的一页式名片与海报（占位说明）。
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

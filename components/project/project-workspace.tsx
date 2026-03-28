"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ManualCopyTextarea } from "@/components/share/manual-copy-textarea";
import { ProjectShareDialog } from "@/components/project/project-share-dialog";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

export type ProjectWorkspaceProps = {
  slug: string;
  name: string;
  tagline: string | undefined;
  shareSnippet: string;
  canonicalUrl: string;
  shareClipboardText: string;
};

const cardBtn =
  "inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-center text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:min-h-[2.5rem] sm:flex-none sm:px-4";

const cardBtnPrimary =
  "inline-flex min-h-[2.75rem] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-900 bg-zinc-900 px-3 py-2.5 text-center text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 active:bg-zinc-950 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:min-h-[2.5rem] sm:flex-none sm:px-4";

export function ProjectWorkspace({
  slug,
  name,
  tagline,
  shareSnippet,
  canonicalUrl,
  shareClipboardText,
}: ProjectWorkspaceProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const timers = useRef<{ link?: number }>({});
  const [linkState, setLinkState] = useState<"base" | "ok" | "err">("base");

  const scheduleResetOk = useCallback(() => {
    if (timers.current.link) {
      window.clearTimeout(timers.current.link);
    }
    timers.current.link = window.setTimeout(() => {
      setLinkState("base");
    }, 2500);
  }, []);

  const onCopyLink = useCallback(async () => {
    setLinkState("base");
    const ok = await copyTextToClipboard(canonicalUrl);
    if (ok) {
      setLinkState("ok");
      scheduleResetOk();
    } else {
      setLinkState("err");
    }
  }, [canonicalUrl, scheduleResetOk]);

  return (
    <>
      <section
        className="mt-8 rounded-2xl border border-zinc-200/90 bg-white px-5 py-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:px-8 md:py-6"
        aria-labelledby="project-workspace-heading"
        data-testid="project-workspace-actions"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="project-workspace-heading"
              className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              项目工作台
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">常用下一步操作</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
          <Link href={`/dashboard/projects/${slug}/edit`} className={cardBtn} data-testid="project-workspace-edit">
            编辑项目
          </Link>
          <Link
            href={`/dashboard/projects/${slug}/updates/new`}
            className={cardBtn}
            data-testid="project-workspace-publish"
          >
            发布动态
          </Link>
          <button
            type="button"
            className={cardBtnPrimary}
            onClick={() => setShareOpen(true)}
            data-testid="project-workspace-share-open"
          >
            分享项目
          </button>
          <button type="button" className={cardBtn} onClick={onCopyLink} data-testid="project-workspace-copy-link">
            {linkState === "ok" ? "已复制链接" : "复制链接"}
          </button>
          <a
            href={canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cardBtn}
            data-testid="project-workspace-open-public"
          >
            查看公开页
          </a>
        </div>

        {linkState === "ok" ? (
          <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            链接已复制，可粘贴到微信、邮件或文档。
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

        <p className="mt-5 border-t border-zinc-100 pt-4 text-[11px] leading-relaxed text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
          <span className="font-medium text-zinc-500 dark:text-zinc-400">即将推出</span>
          ：成员管理、数据刷新、认领状态（占位说明）。
        </p>
      </section>

      <ProjectShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        name={name}
        tagline={tagline}
        shareSnippet={shareSnippet}
        canonicalUrl={canonicalUrl}
        shareClipboardText={shareClipboardText}
      />
    </>
  );
}

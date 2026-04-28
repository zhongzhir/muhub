"use client";

import { useCallback, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { QRCodeCanvas } from "qrcode.react";

export type ProjectSharePosterProps = {
  slug: string;
  name: string;
  intro: string;
  summary?: string;
  highlights?: string[];
  latestActivity?: {
    type:
      | "project_imported"
      | "project_profile_updated"
      | "github_repo_updated"
      | "github_release_detected"
      | "official_update_detected";
    title: string;
    occurredAt: string;
    summary?: string;
  } | null;
  projectPageUrl: string;
  githubUrl?: string | null;
  gitccUrl?: string | null;
  websiteUrl?: string | null;
};

const POSTER_WIDTH = 520;

const actionBtnClass =
  "inline-flex max-w-full shrink-0 items-baseline gap-1 rounded-md px-1 py-0.5 text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";

export function ProjectSharePoster({
  slug,
  name,
  intro,
  summary,
  highlights,
  latestActivity,
  projectPageUrl,
  githubUrl,
  gitccUrl,
  websiteUrl,
}: ProjectSharePosterProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  const downloadPng = useCallback(async () => {
    const el = posterRef.current;
    if (!el) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const link = document.createElement("a");
      link.download = `muhub-${slug}-poster.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setBusy(false);
    }
  }, [slug]);

  const gh = githubUrl?.trim() || "";
  const gitcc = gitccUrl?.trim() || "";
  const web = websiteUrl?.trim() || "";
  const introLines = summary?.trim() || intro.trim() || "在 MUHUB 查看项目主页与动态";
  const badgeList = (highlights ?? []).slice(0, 4);

  return (
    <>
      <button type="button" className={actionBtnClass} onClick={() => setOpen(true)}>
        分享海报
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="poster-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="poster-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              分享海报
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              预览下方海报，可下载图片后自行分享。
            </p>

            <div className="mt-4 flex justify-center overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="origin-top scale-[0.72] sm:scale-[0.85]">
                <div
                  ref={posterRef}
                  style={{ width: POSTER_WIDTH }}
                  className="box-border bg-white p-8 text-left text-zinc-900 shadow-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/logo-horizontal.svg" alt="MUHUB" className="h-7 w-auto object-contain object-left" />
                  <h3 className="mt-6 text-2xl font-bold leading-tight tracking-tight">{name}</h3>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700">
                    {introLines}
                  </p>

                  {badgeList.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {badgeList.map((h) => (
                        <span
                          key={h}
                          className="rounded-full border border-zinc-300 px-2.5 py-1 text-[11px] font-medium text-zinc-700"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {latestActivity ? (
                    <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-[11px] font-semibold text-zinc-500">最新动态</p>
                      <p className="mt-1 text-sm font-medium text-zinc-800">{latestActivity.title}</p>
                      {latestActivity.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{latestActivity.summary}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-zinc-500">{latestActivity.occurredAt}</p>
                    </div>
                  ) : null}

                  {(web || gh || gitcc) ? (
                    <div className="mt-6 space-y-2 border-t border-zinc-200 pt-5 text-sm">
                      {web ? (
                        <p className="break-all">
                          <span className="font-semibold text-zinc-800">官网 </span>
                          <span className="text-blue-700">{web}</span>
                        </p>
                      ) : null}
                      {gh ? (
                        <p className="break-all">
                          <span className="font-semibold text-zinc-800">GitHub </span>
                          <span className="text-blue-700">{gh}</span>
                        </p>
                      ) : null}
                      {gitcc ? (
                        <p className="break-all">
                          <span className="font-semibold text-zinc-800">GitCC </span>
                          <span className="text-blue-700">{gitcc}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-8 flex items-end justify-between gap-4 border-t border-zinc-200 pt-6">
                    <p className="min-w-0 flex-1 break-all text-[11px] leading-snug text-zinc-500">
                      {projectPageUrl}
                    </p>
                    <div className="shrink-0 text-center">
                      <QRCodeCanvas value={projectPageUrl} size={112} level="M" includeMargin={false} />
                      <span className="mt-1 block text-[10px] text-zinc-500">扫码访问</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                onClick={() => void downloadPng()}
              >
                {busy ? "生成中…" : "下载海报"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

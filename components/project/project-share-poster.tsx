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
  tags?: string[];
  category?: string | null;
};

const POSTER_WIDTH = 520;

const actionBtnClass =
  "inline-flex max-w-full shrink-0 items-baseline gap-1 rounded-md px-1 py-0.5 text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";

function formatPosterDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("zh-CN");
  } catch {
    return value.slice(0, 10);
  }
}

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
  tags,
  category,
}: ProjectSharePosterProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const posterRef = useRef<HTMLDivElement>(null);

  const downloadPng = useCallback(async () => {
    const el = posterRef.current;
    if (!el) return;
    setBusy(true);
    setError("");
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: false,
        allowTaint: false,
        logging: false,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `muhub-${slug}-poster.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("[ProjectSharePoster] download failed", e);
      setError("下载失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }, [slug]);

  const gh = githubUrl?.trim() || "";
  const gitcc = gitccUrl?.trim() || "";
  const web = websiteUrl?.trim() || "";
  const introText = summary?.trim() || intro.trim() || "在 MUHUB 查看项目主页与最新动态。";
  const chips = [category, ...(tags ?? []), ...(highlights ?? [])]
    .filter((item): item is string => Boolean(item?.trim()))
    .slice(0, 4);
  const useCases = (highlights ?? []).slice(0, 3);

  return (
    <>
      <button type="button" className={actionBtnClass} onClick={() => setOpen(true)}>
        海报
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
              海报
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              预览下方海报，可下载 PNG 后自行分享。
            </p>

            <div className="mt-4 flex justify-center overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="origin-top scale-[0.72] sm:scale-[0.85]">
                <div
                  ref={posterRef}
                  style={{ width: POSTER_WIDTH }}
                  className="box-border bg-white p-8 text-left text-zinc-900 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white">
                        M
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-wide">MUHUB</p>
                        <p className="text-[11px] text-zinc-500">项目档案</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-medium text-zinc-600">
                      发现好项目
                    </span>
                  </div>

                  <h3 className="mt-8 text-4xl font-black leading-tight tracking-normal">{name}</h3>
                  <p className="mt-4 whitespace-pre-wrap break-words text-base leading-relaxed text-zinc-700">
                    {introText}
                  </p>

                  {chips.length > 0 ? (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {chips.map((h) => (
                        <span
                          key={h}
                          className="rounded-full border border-zinc-300 px-3 py-1.5 text-[12px] font-medium text-zinc-700"
                        >
                          {h.startsWith("#") ? h : `#${h}`}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {useCases.length > 0 ? (
                    <div className="mt-6 rounded-xl bg-zinc-50 p-4">
                      <p className="text-[11px] font-semibold text-zinc-500">适合谁 / 使用场景</p>
                      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-zinc-700">
                        {useCases.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {latestActivity ? (
                    <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-4">
                      <p className="text-[11px] font-semibold text-zinc-500">最新动态</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-800">{latestActivity.title}</p>
                      {latestActivity.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-600">{latestActivity.summary}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-zinc-500">{formatPosterDate(latestActivity.occurredAt)}</p>
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
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-[11px] leading-snug text-zinc-500">{projectPageUrl}</p>
                      <p className="mt-4 text-sm font-semibold text-zinc-800">发现好项目，上 MUHUB</p>
                    </div>
                    <div className="shrink-0 rounded-lg border border-zinc-200 bg-white p-2 text-center">
                      <QRCodeCanvas value={projectPageUrl} size={104} level="M" includeMargin={false} />
                      <span className="mt-1 block text-[10px] text-zinc-500">扫码访问</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

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
                data-testid="project-poster-download"
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

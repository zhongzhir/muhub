"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProjectVisibilityStatus } from "@prisma/client";
import { hideProject, publishProject } from "../actions";

function statusLabel(v: ProjectVisibilityStatus): string {
  switch (v) {
    case "PUBLISHED":
      return "已公开";
    case "HIDDEN":
      return "已隐藏";
    default:
      return "草稿";
  }
}

export function ProjectVisibilityPanel({
  slug,
  visibilityStatus,
}: {
  slug: string;
  visibilityStatus: ProjectVisibilityStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      className="mt-10 rounded-xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-700 dark:bg-zinc-900/40"
      aria-labelledby="project-visibility-heading"
    >
      <h2 id="project-visibility-heading" className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
        发布设置
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        当前状态：<span className="font-medium text-zinc-700 dark:text-zinc-200">{statusLabel(visibilityStatus)}</span>
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            disabled={pending || visibilityStatus === "PUBLISHED"}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await publishProject(slug);
                if (!r.ok) {
                  setError(r.error ?? "操作失败，请稍后重试。");
                  return;
                }
                router.refresh();
              });
            }}
          >
            公开项目
          </button>
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            公开后项目将出现在项目广场，并可被他人浏览与分享。
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            disabled={pending || visibilityStatus === "HIDDEN"}
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await hideProject(slug);
                if (!r.ok) {
                  setError(r.error ?? "操作失败，请稍后重试。");
                  return;
                }
                router.refresh();
              });
            }}
          >
            隐藏项目
          </button>
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            隐藏后项目不会继续在项目广场展示，但你仍可在后台管理它。
          </p>
        </div>
      </div>
    </section>
  );
}

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
    <section className="muhub-card mt-10 px-5 py-5 sm:px-6" aria-labelledby="project-visibility-heading">
      <h2
        id="project-visibility-heading"
        className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
      >
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
            className="muhub-btn-primary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="muhub-btn-secondary px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
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

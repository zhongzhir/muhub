"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ContentSubscriptionWithProject } from "@/lib/content/subscription-types";
import { unfollowContentSubscription } from "@/lib/content/subscription-actions";
import { formatListDate } from "@/lib/format-date";

export function ContentSubscriptionRow({ row }: { row: ContentSubscriptionWithProject }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const href = `/projects/${encodeURIComponent(row.projectSlug)}`;

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{row.projectName}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {row.tagline?.trim() || "暂无简介"}
        </p>
        <dl className="mt-3 grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex flex-wrap gap-x-2">
            <dt>订阅于</dt>
            <dd className="text-zinc-700 dark:text-zinc-300">{formatListDate(row.createdAt)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt>slug</dt>
            <dd className="break-all font-mono text-zinc-600 dark:text-zinc-300">{row.projectSlug}</dd>
          </div>
        </dl>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:flex-wrap dark:border-zinc-800">
        <Link
          href={href}
          className="inline-flex min-h-[2.5rem] flex-1 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-800 sm:flex-none dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          查看项目
        </Link>
        <button
          type="button"
          disabled={pending}
          className="inline-flex min-h-[2.5rem] items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await unfollowContentSubscription(row.projectSlug);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {pending ? "处理中…" : "取消关注"}
        </button>
      </div>
    </article>
  );
}

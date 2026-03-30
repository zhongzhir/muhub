"use client";

import type { ReactNode } from "react";
import { useTransition } from "react";
import { discardDiscoveryCandidateAction, markDiscoveryImportedAction } from "./actions";

export type DiscoveryCandidateRowProps = {
  candidate: {
    id: string;
    source: string;
    name: string;
    description: string | null;
    ownerName: string;
    stars: number;
    primaryLanguage: string | null;
    lastPushedAt: string | null;
    repoUrl: string;
    homepageUrl: string | null;
    isChineseRelated: boolean;
    importHref: string;
  };
};

export function DiscoveryCandidateRow({ candidate: c }: DiscoveryCandidateRowProps) {
  const [pending, startTransition] = useTransition();

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            来源：<span className="font-mono">{c.source}</span>
            {c.isChineseRelated ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                可能与中国相关
              </span>
            ) : null}
          </p>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
          ★ {c.stars}
        </span>
      </div>
      {c.description ? (
        <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">{c.description}</p>
      ) : (
        <p className="mt-3 text-sm italic text-zinc-400">无描述</p>
      )}
      <dl className="mt-3 grid gap-1 text-xs text-zinc-500 dark:text-zinc-500">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-zinc-400">Owner</dt>
          <dd className="font-medium text-zinc-700 dark:text-zinc-300">{c.ownerName}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-zinc-400">语言</dt>
          <dd>{c.primaryLanguage ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-zinc-400">最近推送</dt>
          <dd>
            {c.lastPushedAt
              ? new Date(c.lastPushedAt).toLocaleString("zh-CN")
              : "—"}
          </dd>
        </div>
        {c.homepageUrl ? (
          <div className="flex flex-wrap gap-x-2 break-all">
            <dt className="text-zinc-400">主页</dt>
            <dd>{c.homepageUrl}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <a
          href={c.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          查看仓库 ↗
        </a>
        <LinkButton href={c.importHref} primary>
          导入到 MUHUB
        </LinkButton>
        <button
          type="button"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={() =>
            startTransition(async () => {
              await markDiscoveryImportedAction(c.id);
            })
          }
        >
          标记已导入
        </button>
        <button
          type="button"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/40"
          onClick={() =>
            startTransition(async () => {
              await discardDiscoveryCandidateAction(c.id);
            })
          }
        >
          丢弃
        </button>
      </div>
    </article>
  );
}

function LinkButton({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      className={
        primary
          ? "inline-flex items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          : ""
      }
    >
      {children}
    </a>
  );
}

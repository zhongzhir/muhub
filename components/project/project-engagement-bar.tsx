"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import type { ProjectEngagementPublic } from "@/lib/project-engagement";
import {
  toggleProjectFollow,
  toggleProjectLike,
} from "@/lib/project-engagement-actions";

export type ProjectEngagementBarProps = {
  slug: string;
  /** 数据库中的项目 id；演示/离线页为 null，仅展示只读占位 */
  projectId: string | null;
  interactive: boolean;
  /** 由服务端传入；未登录时点击仅本地提示，不发起 toggle */
  viewerLoggedIn: boolean;
  initial: ProjectEngagementPublic;
  signInCallbackPath: string;
};

const barBtn =
  "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:text-sm";

export function ProjectEngagementBar({
  slug,
  projectId,
  interactive,
  viewerLoggedIn,
  initial,
  signInCallbackPath,
}: ProjectEngagementBarProps) {
  const [eng, setEng] = useState(initial);
  const [hint, setHint] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const applyServerState = useCallback((next: ProjectEngagementPublic) => {
    setEng(next);
  }, []);

  const onLike = () => {
    setHint(null);
    if (interactive && projectId && !viewerLoggedIn) {
      setHint("请先登录后再点赞。");
      return;
    }
    startTransition(async () => {
      const res = await toggleProjectLike(slug);
      if (!res.ok) {
        setHint(res.error);
        return;
      }
      applyServerState(res);
    });
  };

  const onFollow = () => {
    setHint(null);
    if (interactive && projectId && !viewerLoggedIn) {
      setHint("请先登录后再关注项目。");
      return;
    }
    startTransition(async () => {
      const res = await toggleProjectFollow(slug);
      if (!res.ok) {
        setHint(res.error);
        return;
      }
      applyServerState(res);
    });
  };

  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(signInCallbackPath)}`;

  return (
    <div
      className="w-full rounded-xl border border-zinc-200/90 bg-white/60 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900/40"
      data-testid="project-engagement-bar"
    >
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        互动
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${barBtn} border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 ${
            eng.viewerHasLiked ? "border-amber-300/90 bg-amber-50/80 dark:border-amber-700/60 dark:bg-amber-950/40" : ""
          }`}
          disabled={!interactive || isPending || !projectId}
          title={!interactive ? "当前页面为演示或未连接数据库，无法点赞" : undefined}
          onClick={() => {
            if (!interactive || !projectId) {
              setHint("当前项目不支持点赞（演示数据或未连接数据库）。");
              return;
            }
            onLike();
          }}
        >
          <span aria-hidden>👍</span>
          <span>{eng.viewerHasLiked ? "已点赞" : "点赞"}</span>
          <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{eng.likeCount}</span>
        </button>

        <button
          type="button"
          className={`${barBtn} border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 ${
            eng.viewerHasFollowed
              ? "border-violet-300/90 bg-violet-50/80 dark:border-violet-700/60 dark:bg-violet-950/40"
              : ""
          }`}
          disabled={!interactive || isPending || !projectId}
          title={!interactive ? "当前页面为演示或未连接数据库，无法关注" : undefined}
          onClick={() => {
            if (!interactive || !projectId) {
              setHint("当前项目不支持关注（演示数据或未连接数据库）。");
              return;
            }
            onFollow();
          }}
        >
          <span aria-hidden>⭐</span>
          <span>{eng.viewerHasFollowed ? "已关注" : "关注"}</span>
          <span className="tabular-nums text-zinc-500 dark:text-zinc-400">{eng.followCount}</span>
        </button>
      </div>

      {hint ? (
        <div
          role="status"
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <p>{hint}</p>
          {hint.includes("登录") ? (
            <p className="mt-1.5">
              <Link href={signInHref} className="font-semibold underline-offset-2 hover:underline">
                去登录
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        登录后可点赞与关注；关注记录将用于后续动态提醒与订阅能力（V1 不发通知）。
      </p>
    </div>
  );
}

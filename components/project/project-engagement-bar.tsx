"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import type { ProjectEngagementPublic } from "@/lib/project-engagement";
import { toggleProjectLike } from "@/lib/project-engagement-actions";
import {
  followContentSubscription,
  unfollowContentSubscription,
} from "@/lib/content/subscription-actions";

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

const actionBtn =
  "inline-flex max-w-full shrink-0 items-baseline gap-1 rounded-md px-1 py-0.5 text-sm text-zinc-500 transition enabled:hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 enabled:dark:hover:text-zinc-200";

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
      setHint("请先登录后再订阅项目。");
      return;
    }
    startTransition(async () => {
      const res = eng.viewerHasFollowed
        ? await unfollowContentSubscription(slug)
        : await followContentSubscription(slug);
      if (!res.ok) {
        setHint(res.error);
        return;
      }
      applyServerState(res);
    });
  };

  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(signInCallbackPath)}`;

  const likedCls = eng.viewerHasLiked
    ? "text-amber-800 dark:text-amber-300/90"
    : "";
  const followedCls = eng.viewerHasFollowed
    ? "text-violet-800 dark:text-violet-300/90"
    : "";

  return (
    <>
      <span
        className="inline-flex flex-wrap items-baseline gap-x-4 gap-y-2"
        data-testid="project-engagement-bar"
      >
        <button
          type="button"
          className={`${actionBtn} ${likedCls}`}
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
          <span className="tabular-nums">{eng.likeCount}</span>
        </button>

        <button
          type="button"
          className={`${actionBtn} ${followedCls}`}
          disabled={!interactive || isPending || !projectId}
          title={!interactive ? "当前页面为演示或未连接数据库，无法订阅" : undefined}
          data-testid="project-follow-subscribe"
          onClick={() => {
            if (!interactive || !projectId) {
              setHint("当前项目不支持订阅（演示数据或未连接数据库）。");
              return;
            }
            onFollow();
          }}
        >
          <span aria-hidden>⭐</span>
          <span>{eng.viewerHasFollowed ? "Unfollow" : "Follow Project"}</span>
          <span className="tabular-nums">{eng.followCount}</span>
        </button>
      </span>

      {hint ? (
        <div
          role="status"
          className="basis-full text-xs leading-snug text-amber-900 dark:text-amber-200/95"
        >
          <p>{hint}</p>
          {hint.includes("登录") ? (
            <p className="mt-1">
              <Link href={signInHref} className="font-medium underline-offset-2 hover:underline">
                去登录
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

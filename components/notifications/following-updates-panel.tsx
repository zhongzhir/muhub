"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  markAllFollowingNotificationsReadAction,
  markFollowingNotificationRead,
} from "@/lib/project-notification-actions";

export type FollowingNotificationItemProps = {
  id: string;
  projectSlug: string;
  projectName: string;
  eventTitle: string;
  message: string;
  createdAtIso: string;
  readAtIso: string | null;
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function FollowingUpdatesPanel({
  notifications,
}: {
  notifications: FollowingNotificationItemProps[];
}) {
  const [pending, startTransition] = useTransition();

  const hasUnread = notifications.some((n) => !n.readAtIso);

  return (
    <section
      className="mb-10 rounded-2xl border border-teal-200/80 bg-white px-5 py-5 shadow-sm dark:border-teal-900/40 dark:bg-zinc-900"
      aria-labelledby="following-updates-heading"
      data-testid="dashboard-following-updates"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="following-updates-heading"
            className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            最近关注项目更新
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            你在关注的项目发布了新动态时，会在这里出现轻量提醒（站内 V1，非实时推送）。
          </p>
        </div>
        {hasUnread ? (
          <button
            type="button"
            disabled={pending}
            className="shrink-0 text-xs font-medium text-teal-700 underline-offset-2 hover:underline disabled:opacity-50 dark:text-teal-300"
            onClick={() =>
              startTransition(async () => {
                await markAllFollowingNotificationsReadAction();
              })
            }
          >
            全部标为已读
          </button>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          你关注的项目最近还没有新的公开动态。去{" "}
          <Link href="/projects" className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-400">
            项目广场
          </Link>{" "}
          逛逛，或在项目页点击「关注」。
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {notifications.map((n) => {
            const unread = !n.readAtIso;
            return (
              <li key={n.id}>
                <Link
                  href={`/projects/${encodeURIComponent(n.projectSlug)}`}
                  className={`block rounded-xl border px-3.5 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                    unread
                      ? "border-teal-300/90 bg-teal-50/50 dark:border-teal-800/50 dark:bg-teal-950/25"
                      : "border-zinc-200 bg-zinc-50/40 dark:border-zinc-700 dark:bg-zinc-900/40"
                  }`}
                  onClick={() =>
                    startTransition(async () => {
                      if (unread) {
                        await markFollowingNotificationRead(n.id);
                      }
                    })
                  }
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{n.projectName}</span>
                    {unread ? (
                      <span className="rounded-full bg-teal-600/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:bg-teal-500/20 dark:text-teal-200">
                        未读
                      </span>
                    ) : null}
                    <span className="ml-auto text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatTime(n.createdAtIso)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">{n.eventTitle}</p>
                  <p className="mt-0.5 text-sm leading-snug text-zinc-700 dark:text-zinc-300">{n.message}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

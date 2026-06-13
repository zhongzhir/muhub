"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export function TrainingAuthButton({
  loggedIn,
  loginHref,
}: {
  loggedIn: boolean;
  loginHref: string;
}) {
  if (!loggedIn) {
    return (
      <Link
        href={loginHref}
        className="shrink-0 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-zinc-50"
      >
        登录
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/training" })}
      className="shrink-0 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-200 dark:hover:text-zinc-50"
    >
      退出登录
    </button>
  );
}

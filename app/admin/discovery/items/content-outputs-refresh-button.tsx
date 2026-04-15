"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

const btnClass =
  "rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

export function ContentOutputsRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={btnClass}
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      {pending ? "Refreshing..." : "Refresh"}
    </button>
  );
}

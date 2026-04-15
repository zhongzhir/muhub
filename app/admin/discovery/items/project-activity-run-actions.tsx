"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { runProjectActivityAction } from "./actions";

const btnClass =
  "rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

export function ProjectActivityRunActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={btnClass}
        disabled={pending}
        onClick={() => {
          setToast(null);
          startTransition(() => {
            void (async () => {
              const result = await runProjectActivityAction();
              if (result.ok) {
                setToast({
                  kind: "ok",
                  text: `项目动态更新完成 · 扫描 ${result.processed} 个项目 · 新增 ${result.created} 条动态`,
                });
                router.refresh();
              } else {
                setToast({
                  kind: "err",
                  text: "项目动态更新失败",
                });
              }
            })();
          });
        }}
      >
        {pending ? "执行中..." : "更新项目动态"}
      </button>
      {toast ? (
        <p
          className={
            toast.kind === "ok"
              ? "rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }
        >
          {toast.text}
        </p>
      ) : null}
    </div>
  );
}

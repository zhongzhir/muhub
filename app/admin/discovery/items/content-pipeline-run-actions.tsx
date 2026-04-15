"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { runContentPipelineAction } from "./actions";

const btnClass =
  "rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

function shortOutput(output: string) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
  return lines.join(" | ");
}

export function ContentPipelineRunActions() {
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
              const result = await runContentPipelineAction();
              if (result.ok) {
                const outputSnippet = shortOutput(result.output);
                setToast({
                  kind: "ok",
                  text: outputSnippet
                    ? `内容生成完成 · ${outputSnippet}`
                    : "内容生成完成",
                });
                router.refresh();
              } else {
                setToast({
                  kind: "err",
                  text: `内容生成失败：${result.error}`,
                });
              }
            })();
          });
        }}
      >
        {pending ? "执行中..." : "运行内容生成"}
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

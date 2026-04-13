"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { runGithubDiscoveryV3Action, runRssDiscoveryAction } from "./actions";

const btnClass =
  "rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

export function DiscoveryRunActions() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<"github" | "rss" | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={btnClass}
          disabled={pending}
          onClick={() => {
            setToast(null);
            setRunning("github");
            startTransition(() => {
              void (async () => {
                const result = await runGithubDiscoveryV3Action();
                if (result.ok) {
                  const { inserted, skipped } = result.summary;
                  setToast({
                    kind: "ok",
                    text: `GitHub V3 completed · Inserted ${inserted} · Skipped ${skipped}`,
                  });
                  router.refresh();
                } else {
                  setToast({ kind: "err", text: `GitHub V3 failed: ${result.error}` });
                }
                setRunning(null);
              })();
            });
          }}
        >
          {running === "github" ? "Running..." : "Run GitHub V3"}
        </button>
        <button
          type="button"
          className={btnClass}
          disabled={pending}
          onClick={() => {
            setToast(null);
            setRunning("rss");
            startTransition(() => {
              void (async () => {
                const result = await runRssDiscoveryAction();
                if (result.ok) {
                  setToast({
                    kind: "ok",
                    text: `RSS Discovery completed · Inserted ${result.summary.delta}`,
                  });
                  router.refresh();
                } else {
                  setToast({ kind: "err", text: `RSS Discovery failed: ${result.error}` });
                }
                setRunning(null);
              })();
            });
          }}
        >
          {running === "rss" ? "Running..." : "Run RSS Discovery"}
        </button>
      </div>
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

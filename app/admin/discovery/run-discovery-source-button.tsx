"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runDiscoverySourceAction } from "./actions";

export function RunDiscoverySourceButton(props: {
  sourceKey: string;
  label?: string;
  runnable?: boolean;
  blockedReason?: string;
}) {
  const { sourceKey, label, runnable = true, blockedReason } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (!runnable) {
    return (
      <span className="inline-flex flex-col gap-1">
        <button
          type="button"
          disabled
          title={blockedReason ?? "来源已停用或不可运行"}
          className="cursor-not-allowed rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-400 dark:border-zinc-700"
        >
          {label ?? `运行 ${sourceKey}`}
        </button>
        <span className="text-[10px] text-amber-700 dark:text-amber-300">
          {blockedReason ?? "已停用，不可运行"}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await runDiscoverySourceAction(sourceKey);
            if (r.ok) {
              setMsg(`OK ${r.runId}`);
              router.refresh();
            } else {
              setMsg(r.error);
            }
          });
        }}
        className="rounded border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-600"
      >
        {label ?? `运行 ${sourceKey}`}
      </button>
      {msg ? <span className="text-[10px] text-zinc-500">{msg}</span> : null}
    </span>
  );
}

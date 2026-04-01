"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runDiscoverySourceAction } from "./actions";

export function RunDiscoverySourceButton(props: {
  sourceKey: string;
  label?: string;
}) {
  const { sourceKey, label } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

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

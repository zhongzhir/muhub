"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyDiscoverySourceAsWebsiteScanAction } from "./actions";

export function CopyAsWebsiteScanButton(props: { sourceId: string }) {
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
            const r = await copyDiscoverySourceAsWebsiteScanAction(props.sourceId);
            if (!r.ok) {
              setMsg(r.error);
              return;
            }
            if (r.id) {
              router.push(`/admin/discovery/sources/${r.id}`);
            }
          });
        }}
        className="rounded border border-teal-600 px-3 py-1.5 text-sm text-teal-800 disabled:opacity-50 dark:border-teal-500 dark:text-teal-200"
      >
        {pending ? "复制中…" : "复制为 WEBSITE_SCAN"}
      </button>
      {msg ? <span className="text-[10px] text-red-600 dark:text-red-400">{msg}</span> : null}
    </span>
  );
}

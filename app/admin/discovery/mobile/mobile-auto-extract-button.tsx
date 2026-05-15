"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function MobileAutoExtractButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run() {
    setMessage(null);
    startTransition(() => {
      void (async () => {
        const resp = await fetch(
          `/api/admin/discovery/mobile-capture/${encodeURIComponent(itemId)}/auto-extract`,
          { method: "POST" },
        );
        const data = (await resp.json()) as {
          ok?: boolean;
          error?: string;
          autoExtraction?: { attempted: boolean; ok?: boolean; error?: string };
        };
        if (!resp.ok || !data.ok) {
          setMessage(data.error || "自动提取失败");
          return;
        }
        if (data.autoExtraction?.attempted && data.autoExtraction.ok === false) {
          setMessage(data.autoExtraction.error || "自动提取失败");
          router.refresh();
          return;
        }
        setMessage("已重新提取");
        router.refresh();
      })();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={run}
        className="rounded border border-zinc-300 px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700"
      >
        {pending ? "处理中..." : "重新自动提取"}
      </button>
      {message ? <span className="max-w-40 text-right text-[11px] text-zinc-500">{message}</span> : null}
    </div>
  );
}

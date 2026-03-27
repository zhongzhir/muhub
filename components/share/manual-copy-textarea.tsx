"use client";

import { useId } from "react";

type Props = {
  value: string;
  /** 简短辅助，如「正式链接」「分享文案」 */
  hint?: string;
};

/**
 * 复制 API 失败时供用户长按/选取复制（常见于移动端 WebView、权限受限场景）
 */
export function ManualCopyTextarea({ value, hint = "长按下方文本可复制" }: Props) {
  const id = useId();

  const rows = value.includes("\n") ? Math.min(6, value.split("\n").length + 1) : 3;

  return (
    <div className="mt-2 w-full min-w-0" data-testid="manual-copy-fallback">
      <label htmlFor={id} className="mb-1 block max-w-full text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
        {hint}
      </label>
      <textarea
        id={id}
        readOnly
        value={value}
        rows={rows}
        spellCheck={false}
        className="max-h-[min(50vh,16rem)] w-full min-h-[4.5rem] resize-y overflow-x-auto overflow-y-auto break-all rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-900 [overflow-wrap:anywhere] selection:bg-amber-200 sm:p-2.5 sm:text-xs dark:border-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-100 dark:selection:bg-amber-900/60"
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  );
}

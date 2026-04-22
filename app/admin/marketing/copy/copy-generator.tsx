"use client";

import { useActionState, useState } from "react";
import type { MarketingCopyActionState } from "./actions";
import { generateMarketingCopyAction } from "./actions";

function CopyButton({ text }: { text: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setMessage("已复制");
          } catch {
            setMessage("复制失败");
          }
          setTimeout(() => setMessage(""), 1200);
        }}
      >
        复制
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}

const initialState: MarketingCopyActionState = {
  ok: false,
  message: "",
  template: "general",
  output: null,
};

export function MarketingCopyGenerator({ projectId }: { projectId: string }) {
  const [template, setTemplate] = useState<"general" | "social">("general");
  const [state, formAction, pending] = useActionState(generateMarketingCopyAction, initialState);
  const output = state.output;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="template" value={template} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTemplate("general")}
          className={`rounded px-3 py-1 text-xs ${template === "general" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"}`}
        >
          通用模板
        </button>
        <button
          type="button"
          onClick={() => setTemplate("social")}
          className={`rounded px-3 py-1 text-xs ${template === "social" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"}`}
        >
          社交模板
        </button>
        <button type="submit" disabled={pending} className="muhub-btn-primary px-3 py-2 text-sm disabled:opacity-60">
          {pending ? "生成中..." : "生成文案"}
        </button>
      </div>

      {state.message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            state.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      {output ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500">一句话介绍</p>
            <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{output.oneLiner}</p>
            <CopyButton text={output.oneLiner} />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500">项目广场短文案</p>
            <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{output.plaza}</p>
            <CopyButton text={output.plaza} />
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-xs text-zinc-500">社交分享文案</p>
            <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{output.social}</p>
            <CopyButton text={output.social} />
          </div>
        </div>
      ) : null}
    </form>
  );
}

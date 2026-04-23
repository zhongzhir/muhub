"use client";

import { useActionState, useMemo, useState } from "react";
import type { MarketingCopyActionState, WriteSummaryActionState } from "./actions";
import { generateMarketingCopyAction, writeSimpleSummaryFromCopyAction } from "./actions";

function CopyButton({ text }: { text: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex items-center gap-2">
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

const initialGenerateState: MarketingCopyActionState = {
  ok: false,
  message: "",
  template: "general",
  output: null,
};

const initialWriteState: WriteSummaryActionState = {
  ok: false,
  message: "",
};

export function MarketingCopyGenerator({ projectId }: { projectId: string }) {
  const [template, setTemplate] = useState<"general" | "social">("general");
  const [state, formAction, pending] = useActionState(generateMarketingCopyAction, initialGenerateState);
  const [writeState, writeAction, writePending] = useActionState(
    writeSimpleSummaryFromCopyAction,
    initialWriteState,
  );
  const [sessionOutputs, setSessionOutputs] = useState<
    Partial<Record<"general" | "social", NonNullable<MarketingCopyActionState["output"]>>>
  >({});
  const [copyAllMessage, setCopyAllMessage] = useState("");

  const switchTemplate = (nextTemplate: "general" | "social") => {
    if (state.ok && state.output) {
      setSessionOutputs((prev) => ({ ...prev, [state.template]: state.output }));
    }
    setTemplate(nextTemplate);
  };

  const latestOutputForTemplate =
    state.ok && state.output && state.template === template ? state.output : null;
  const activeOutput = latestOutputForTemplate ?? sessionOutputs[template] ?? null;

  const allCopyText = useMemo(() => {
    if (!activeOutput) {
      return "";
    }
    const templateLabel = template === "general" ? "通用版" : "社交版";
    return [
      `【${templateLabel}】`,
      "",
      `一、通用介绍`,
      activeOutput.oneLiner,
      "",
      `二、项目广场文案`,
      activeOutput.plaza,
      "",
      `三、社交分享文案`,
      activeOutput.social,
    ].join("\n");
  }, [activeOutput, template]);

  const copyAll = async () => {
    if (!allCopyText) {
      setCopyAllMessage("暂无可复制内容，请先生成文案。");
      return;
    }
    try {
      await navigator.clipboard.writeText(allCopyText);
      setCopyAllMessage("已复制全部文案。");
    } catch {
      setCopyAllMessage("复制失败，请重试。");
    }
    setTimeout(() => setCopyAllMessage(""), 1800);
  };

  const templateTitle = template === "general" ? "通用版" : "社交版";
  const items = activeOutput
    ? [
        { key: "one", title: "通用介绍", text: activeOutput.oneLiner },
        { key: "plaza", title: "项目广场文案", text: activeOutput.plaza },
        { key: "social", title: "社交分享文案", text: activeOutput.social },
      ]
    : [];

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="template" value={template} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => switchTemplate("general")}
          className={`rounded px-3 py-1 text-xs ${template === "general" ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"}`}
        >
          通用模板
        </button>
        <button
          type="button"
          onClick={() => switchTemplate("social")}
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
      </form>

      {writeState.message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            writeState.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {writeState.message}
        </p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{templateTitle}文案结果</p>
          <button
            type="button"
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            onClick={copyAll}
          >
            复制全部
          </button>
        </div>
        {copyAllMessage ? <p className="mt-1 text-xs text-zinc-500">{copyAllMessage}</p> : null}
        {activeOutput ? (
          <p className="mt-1 text-xs text-zinc-500">
            当前采用：{activeOutput.mode === "expressive" ? "增强表达（expressive）" : "平衡表达（balanced）"}
          </p>
        ) : null}
        {!activeOutput ? (
          <p className="mt-2 text-sm text-zinc-500">当前模板还没有生成结果。</p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">已在当前会话保留最近一次生成结果，可切换模板查看。</p>
        )}
      </div>

      {activeOutput ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.key} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="text-xs text-zinc-500">{templateTitle} · {item.title}</p>
              <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{item.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <CopyButton text={item.text} />
                <span className="text-xs text-zinc-500">约 {item.text.length} 字</span>
                <form action={writeAction}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="summary" value={item.text} />
                  <button
                    type="submit"
                    disabled={writePending}
                    className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    {writePending ? "写入中..." : "写入通俗介绍"}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

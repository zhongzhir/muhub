"use client";

import { useActionState } from "react";
import { submitHomework, TRAINING_SESSION_OPTIONS } from "../actions";
import type { TrainingFormState } from "../lib/types";

const initialState: TrainingFormState = { ok: false };

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>;
}

export function HomeworkForm() {
  const [state, formAction, pending] = useActionState(submitHomework, initialState);

  if (state.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {state.message && !state.ok ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">姓名 *</span>
          <input name="name" type="text" required className={inputClass} />
          <FieldError message={state.fieldErrors?.name} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">单位 *</span>
          <input name="organization" type="text" required className={inputClass} />
          <FieldError message={state.fieldErrors?.organization} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">手机 *</span>
          <input name="phone" type="tel" required className={inputClass} />
          <FieldError message={state.fieldErrors?.phone} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">课程期次 *</span>
          <select name="session" required className={inputClass} defaultValue="">
            <option value="" disabled>
              请选择期次
            </option>
            {TRAINING_SESSION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.session} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">作业标题 *</span>
          <input name="homeworkTitle" type="text" required className={inputClass} placeholder="例如：AI辅助内容生产实训报告" />
          <FieldError message={state.fieldErrors?.homeworkTitle} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">作业内容 *</span>
          <textarea
            name="homeworkContent"
            rows={8}
            required
            className={inputClass}
            placeholder="请填写实训报告正文、心得体会或关键结论…"
          />
          <FieldError message={state.fieldErrors?.homeworkContent} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">附件链接（选填）</span>
          <input
            name="attachmentUrl"
            type="url"
            className={inputClass}
            placeholder="网盘链接、文档 URL 等（V1 占位，后续支持文件上传）"
          />
          <p className="mt-1 text-xs text-zinc-400">当前版本暂不支持直接上传文件，请填写可访问的链接地址。</p>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:px-8"
        style={{ background: "#1a2035" }}
      >
        {pending ? "提交中…" : "提交作业"}
      </button>
    </form>
  );
}

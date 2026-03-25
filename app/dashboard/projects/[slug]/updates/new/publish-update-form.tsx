"use client";

import { useActionState } from "react";
import { publishProjectUpdate, type PublishProjectUpdateFormState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400";

const initialState: PublishProjectUpdateFormState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export function PublishUpdateForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(publishProjectUpdate, initialState);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="slug" value={slug} />

      {state.formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          {state.formError}
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="title">
          标题 <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          autoComplete="off"
          className={inputClass}
          placeholder="例如：版本发布说明"
        />
        <FieldError message={state.fieldErrors?.title} />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="content">
          内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="content"
          name="content"
          required
          rows={8}
          className={`${inputClass} min-h-[160px] resize-y`}
          placeholder="支持多行正文"
        />
        <FieldError message={state.fieldErrors?.content} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "发布中…" : "发布"}
      </button>
    </form>
  );
}

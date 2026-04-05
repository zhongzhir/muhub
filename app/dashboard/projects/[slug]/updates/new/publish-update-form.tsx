"use client";

import { useActionState } from "react";
import { useRedirectFromActionState } from "@/components/forms/use-redirect-from-action-state";
import { publishProjectUpdate, type PublishProjectUpdateFormState } from "./actions";

const inputClass = "muhub-input mt-1";

const initialState: PublishProjectUpdateFormState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export function PublishUpdateForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(publishProjectUpdate, initialState);

  useRedirectFromActionState(state.redirectPath);

  return (
    <form action={formAction} className="muhub-card space-y-6 p-5 sm:p-6">
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

      <button type="submit" disabled={pending} className="muhub-btn-primary px-4 py-2.5 disabled:opacity-60">
        {pending ? "发布中…" : "发布"}
      </button>
    </form>
  );
}

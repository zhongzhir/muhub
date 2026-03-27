"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importGitHubRepo, type ImportGitHubFormState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400";

const initialState: ImportGitHubFormState = { ok: false };

export function ImportGitHubForm() {
  const [state, formAction, pending] = useActionState(importGitHubRepo, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          {state.formError}
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="repoUrl">
          GitHub 仓库地址
        </label>
        <input
          id="repoUrl"
          name="repoUrl"
          type="url"
          required
          autoComplete="off"
          placeholder="https://github.com/vercel/next.js"
          aria-label="GitHub 仓库地址"
          className={inputClass}
        />
        <p className="mt-2 text-xs text-zinc-500">
          支持标准 GitHub 仓库链接（可带末尾 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/</code> 或{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.git</code>）。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "导入中…" : "导入项目"}
        </button>
        <Link
          href="/dashboard/projects/new"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          手动创建项目
        </Link>
      </div>
    </form>
  );
}

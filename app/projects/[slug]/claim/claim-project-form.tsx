"use client";

import { useActionState } from "react";
import Link from "next/link";
import { claimProject, type ClaimProjectFormState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400";

const initialState: ClaimProjectFormState = { ok: false };

type Props = {
  slug: string;
  projectName: string;
  hintGithubUrl: string;
};

export function ClaimProjectForm({ slug, projectName, hintGithubUrl }: Props) {
  const [state, formAction, pending] = useActionState(claimProject, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />

      {state.formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          {state.formError}
        </div>
      ) : null}

      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        你正在认领项目 <strong className="text-zinc-900 dark:text-zinc-100">{projectName}</strong>
        （<span className="font-mono text-sm">{slug}</span>
        ）。请输入<strong>与此项目已保存的代码仓库（GitHub / Gitee）</strong>一致的地址以完成认领。当前记录为：
      </p>
      <p className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 font-mono text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {hintGithubUrl}
      </p>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="repoUrl">
          仓库 URL（GitHub / Gitee）
        </label>
        <input
          id="repoUrl"
          data-testid="repo-url-input"
          name="repoUrl"
          type="url"
          required
          autoComplete="off"
          placeholder={hintGithubUrl}
          aria-label="代码仓库 URL"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? "提交中…" : "认领项目"}
        </button>
        <Link
          href={`/projects/${slug}`}
          className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          返回项目页
        </Link>
      </div>
    </form>
  );
}

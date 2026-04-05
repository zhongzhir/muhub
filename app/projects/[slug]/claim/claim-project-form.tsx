"use client";

import { useActionState } from "react";
import Link from "next/link";
import { claimProject, type ClaimProjectFormState } from "./actions";

const inputClass = "muhub-input mt-1";

const initialState: ClaimProjectFormState = { ok: false };

type Props = {
  slug: string;
  projectName: string;
  hintGithubUrl: string;
  /** 未关联 GitHub 账户时为 true，禁止提交 */
  githubClaimBlocked?: boolean;
};

export function ClaimProjectForm({
  slug,
  projectName,
  hintGithubUrl,
  githubClaimBlocked = false,
}: Props) {
  const [state, formAction, pending] = useActionState(claimProject, initialState);

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

      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        你正在认领项目 <strong className="text-zinc-900 dark:text-zinc-100">{projectName}</strong>
        （页面路径 <span className="font-mono text-sm break-all">{slug}</span>
        ）。请输入<strong>与此项目已保存的代码仓库（GitHub / Gitee）</strong>一致的链接以完成认领。当前记录为：
      </p>
      <p className="rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2 font-mono text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {hintGithubUrl}
      </p>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="repoUrl">
          代码仓库链接（GitHub / Gitee）
        </label>
        <input
          id="repoUrl"
          data-testid="repo-url-input"
          name="repoUrl"
          type="url"
          required={!githubClaimBlocked}
          disabled={githubClaimBlocked}
          autoComplete="off"
          placeholder={hintGithubUrl}
          aria-label="代码仓库链接"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={pending || githubClaimBlocked}
          className="muhub-btn-primary px-4 py-3 disabled:opacity-60"
        >
          {pending ? "提交中…" : "认领项目"}
        </button>
        <Link href={`/projects/${encodeURIComponent(slug)}`} className="muhub-btn-secondary px-4 py-3">
          返回项目页
        </Link>
      </div>
    </form>
  );
}

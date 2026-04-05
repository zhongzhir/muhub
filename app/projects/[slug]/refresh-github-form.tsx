"use client";

import { useActionState } from "react";
import { useRedirectFromActionState } from "@/components/forms/use-redirect-from-action-state";
import {
  refreshProjectGithubSnapshot,
  type RefreshGithubSnapshotState,
} from "./actions";

const initialState: RefreshGithubSnapshotState = { ok: true };

export function RefreshGithubSnapshotForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(
    refreshProjectGithubSnapshot,
    initialState,
  );

  useRedirectFromActionState(state.redirectPath);

  return (
    <form action={formAction} className="flex flex-col items-stretch gap-2 sm:items-end">
      <input type="hidden" name="slug" value={slug} />
      {!state.ok ? (
        <p
          role="alert"
          className="max-w-sm text-right text-xs text-red-600 dark:text-red-400"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        data-testid="refresh-github-snapshot"
        className="muhub-btn-outline shrink-0 px-3 py-2 disabled:opacity-60"
      >
        {pending ? "刷新中…" : "刷新仓库数据"}
      </button>
    </form>
  );
}

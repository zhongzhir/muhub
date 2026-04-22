"use client";

import { useActionState, useState } from "react";
import type { AdminProjectPublishFormState } from "./actions";
import { updateAdminProjectPublishState } from "./actions";

const initialState: AdminProjectPublishFormState = { ok: false, message: "" };

export function PublishActionsForm({
  projectId,
  canArchive,
}: {
  projectId: string;
  canArchive: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateAdminProjectPublishState, initialState);
  const [activeIntent, setActiveIntent] = useState<string>("");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
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
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          onClick={() => setActiveIntent("publish")}
          className="muhub-btn-primary px-3 py-2 text-sm disabled:opacity-60"
        >
          {pending && activeIntent === "publish" ? "发布中..." : "发布"}
        </button>
        <button
          type="submit"
          name="intent"
          value="unpublish"
          disabled={pending}
          onClick={() => setActiveIntent("unpublish")}
          className="muhub-btn-secondary px-3 py-2 text-sm disabled:opacity-60"
        >
          {pending && activeIntent === "unpublish" ? "处理中..." : "取消公开"}
        </button>
        <button
          type="submit"
          name="intent"
          value="hide"
          disabled={pending}
          onClick={() => setActiveIntent("hide")}
          className="muhub-btn-secondary px-3 py-2 text-sm disabled:opacity-60"
        >
          {pending && activeIntent === "hide" ? "处理中..." : "隐藏"}
        </button>
        {canArchive ? (
          <button
            type="submit"
            name="intent"
            value="archive"
            disabled={pending}
            onClick={() => setActiveIntent("archive")}
            className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-800 disabled:opacity-60 dark:border-red-800 dark:text-red-300"
          >
            {pending && activeIntent === "archive" ? "处理中..." : "归档"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

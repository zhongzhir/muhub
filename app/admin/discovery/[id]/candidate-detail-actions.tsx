"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveDiscoveryCandidateAction,
  mergeDiscoveryCandidateAction,
  rejectDiscoveryCandidateAction,
} from "../actions";

export function CandidateDetailActions(props: {
  candidateId: string;
  canMutate: boolean;
}) {
  const { candidateId, canMutate } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [mergeProjectId, setMergeProjectId] = useState("");

  if (!canMutate) {
    return (
      <p className="text-sm text-zinc-500">
        该待筛选项目已处理，可返回
        {" "}
        <Link href="/admin/discovery" className="underline">
          列表
        </Link>
        {" "}
        继续处理其他项目。
      </p>
    );
  }

  const onApprove = () => {
    setMessage(null);
    start(async () => {
      const result = await approveDiscoveryCandidateAction(candidateId);
      if (result.ok && result.projectId) {
        router.push(`/admin/projects/${result.projectId}/edit`);
        return;
      }
      if (!result.ok) {
        setMessage(result.error);
      }
    });
  };

  const onReject = () => {
    setMessage(null);
    start(async () => {
      const result = await rejectDiscoveryCandidateAction(candidateId, rejectNote.trim() || undefined);
      if (result.ok) {
        setMessage("已标记为不收录。");
        router.refresh();
      } else {
        setMessage(result.error);
      }
    });
  };

  const onMerge = () => {
    const projectId = mergeProjectId.trim();
    if (!projectId) {
      setMessage("请先填写目标项目 ID。");
      return;
    }

    setMessage(null);
    start(async () => {
      const result = await mergeDiscoveryCandidateAction(candidateId, projectId);
      if (result.ok) {
        router.push(`/admin/projects/${projectId}/edit`);
        return;
      } else {
        setMessage(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onApprove}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-emerald-800"
        >
          收录为项目
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onReject}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
        >
          不收录
        </button>
      </div>

      <div>
        <label className="block text-xs text-zinc-500">不收录备注（可选）</label>
        <textarea
          className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          rows={2}
          value={rejectNote}
          onChange={(event) => setRejectNote(event.target.value)}
        />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">合并到已有项目</p>
        <p className="mt-1 text-xs text-zinc-500">
          填写已有项目的
          {" "}
          <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">id</code>
          {" "}
          而不是 slug，候选项目的外部链接会一并同步过去。
        </p>
        <input
          className="mt-2 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="Project cuid"
          value={mergeProjectId}
          onChange={(event) => setMergeProjectId(event.target.value)}
        />
        <button
          type="button"
          disabled={pending}
          onClick={onMerge}
          className="mt-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
        >
          合并到已有项目
        </button>
      </div>

      {message ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p> : null}
    </div>
  );
}

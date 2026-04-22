"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DiscoverySignalStatus } from "@prisma/client";
import {
  convertDiscoverySignalAction,
  markDiscoverySignalReviewedAction,
  rejectDiscoverySignalAction,
} from "../actions";

export function SignalDetailActions(props: {
  signalId: string;
  status: DiscoverySignalStatus;
}) {
  const { signalId, status } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canMarkReviewed = status !== "CONVERTED" && status !== "REJECTED";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMessage(null);
              const r = await convertDiscoverySignalAction(signalId);
              if (r.ok && r.candidateId) {
                router.push(`/admin/discovery/${r.candidateId}`);
                return;
              }
              if (!r.ok) {
                setMessage(r.error);
              }
            })
          }
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-emerald-800"
        >
          转为候选项目
        </button>
        {canMarkReviewed ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMessage(null);
                const r = await markDiscoverySignalReviewedAction(signalId, note);
                if (r.ok) {
                  setMessage("已标记为已查看。");
                  router.refresh();
                  return;
                }
                setMessage(r.error);
              })
            }
            className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-800 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300"
          >
            标记为已查看
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMessage(null);
              const r = await rejectDiscoverySignalAction(signalId, note);
              if (r.ok) {
                setMessage("已标记为拒绝。");
                router.refresh();
                return;
              }
              setMessage(r.error);
            })
          }
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-800 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
        >
          忽略/拒绝
        </button>
      </div>

      <div>
        <label className="block text-xs text-zinc-500">审核备注（可选）</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
      </div>

      {message ? <p className="text-sm text-zinc-700 dark:text-zinc-300">{message}</p> : null}
    </div>
  );
}

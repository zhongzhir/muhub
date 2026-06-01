"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityHintFeedbackModal } from "./entity-hint-feedback-modal";
import type { EntityHintFeedbackAction } from "@/lib/discovery/entity/feedback-types";

const ACTIONS: EntityHintFeedbackAction[] = [
  "ACCEPT",
  "REJECT",
  "RETYPE",
  "CHANGE_PRIMARY_SOURCE",
  "NEEDS_REVIEW",
];

const ACTION_LABELS: Record<EntityHintFeedbackAction, string> = {
  ACCEPT: "接受",
  REJECT: "拒绝",
  RETYPE: "改类型",
  CHANGE_PRIMARY_SOURCE: "改来源",
  NEEDS_REVIEW: "待观察",
  UNSURE: "不确定",
};

const ACTION_STYLES: Record<EntityHintFeedbackAction, string> = {
  ACCEPT:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  REJECT:
    "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
  RETYPE:
    "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200",
  CHANGE_PRIMARY_SOURCE:
    "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
  NEEDS_REVIEW:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  UNSURE:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
};

export function EntityHintFeedbackPanel({
  hintId,
  hintName,
}: {
  hintId: string;
  hintName?: string;
}) {
  const router = useRouter();
  const [modalAction, setModalAction] = useState<EntityHintFeedbackAction | null>(null);

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900 dark:bg-sky-950/20">
      <h2 className="text-sm font-semibold text-sky-900 dark:text-sky-100">
        Discovery Feedback
      </h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        每次人工判断都会写入反馈数据集，用于后续 Learning Loop。
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setModalAction(action)}
            className={`rounded border px-3 py-1.5 text-xs font-medium ${ACTION_STYLES[action]}`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      <EntityHintFeedbackModal
        key={modalAction ? `${hintId}-${modalAction}` : "closed"}
        hintId={hintId}
        hintName={hintName}
        open={modalAction != null}
        action={modalAction}
        onClose={() => setModalAction(null)}
        onSuccess={() => router.refresh()}
      />
    </section>
  );
}

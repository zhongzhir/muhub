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
  "MERGE",
  "NEEDS_REVIEW",
];

const ACTION_LABELS: Record<EntityHintFeedbackAction, string> = {
  ACCEPT: "Accept",
  REJECT: "Reject",
  RETYPE: "Retype",
  CHANGE_PRIMARY_SOURCE: "Source",
  MERGE: "Merge",
  NEEDS_REVIEW: "Review",
  UNSURE: "Unsure",
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
  MERGE:
    "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200",
  NEEDS_REVIEW:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  UNSURE:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
};

export function EntityHintFeedbackActions({
  hintId,
  hintName,
  compact = false,
}: {
  hintId: string;
  hintName?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [modalAction, setModalAction] = useState<EntityHintFeedbackAction | null>(null);

  return (
    <>
      <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-2"}`}>
        {ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setModalAction(action)}
            className={`rounded border px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[action]}`}
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
    </>
  );
}

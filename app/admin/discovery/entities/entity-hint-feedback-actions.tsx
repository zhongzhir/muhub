"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityHintFeedbackModal } from "./entity-hint-feedback-modal";
import type { EntityHintFeedbackAction } from "@/lib/discovery/entity/feedback-types";

const ACTION_STYLES: Record<EntityHintFeedbackAction, string> = {
  ACCEPT:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  REJECT:
    "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
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
      <div className={`flex flex-wrap gap-1 ${compact ? "" : "gap-2"}`}>
        {(["ACCEPT", "REJECT", "UNSURE"] as const).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => setModalAction(action)}
            className={`rounded border px-2 py-0.5 text-xs font-medium ${ACTION_STYLES[action]}`}
          >
            {action}
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

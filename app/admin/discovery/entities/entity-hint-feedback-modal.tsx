"use client";

import { useState, useTransition } from "react";
import { submitEntityHintFeedbackAction } from "./actions";
import {
  ENTITY_HINT_FEEDBACK_TAGS,
  FEEDBACK_TAG_LABELS,
  type EntityHintFeedbackAction,
  type EntityHintFeedbackTag,
} from "@/lib/discovery/entity/feedback-types";
import { ENTITY_TYPES } from "@/lib/discovery/entity/types";

const ACTION_LABELS: Record<EntityHintFeedbackAction, string> = {
  ACCEPT: "Accept",
  REJECT: "Reject",
  RETYPE: "Retype",
  CHANGE_PRIMARY_SOURCE: "Change primary source",
  MERGE: "Merge",
  NEEDS_REVIEW: "Needs review",
  UNSURE: "Unsure",
};

export type EntityHintFeedbackModalProps = {
  hintId: string;
  hintName?: string;
  open: boolean;
  action: EntityHintFeedbackAction | null;
  onClose: () => void;
  onSuccess?: () => void;
};

export function EntityHintFeedbackModal({
  hintId,
  hintName,
  open,
  action,
  onClose,
  onSuccess,
}: EntityHintFeedbackModalProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<EntityHintFeedbackTag[]>([]);
  const [finalEntityType, setFinalEntityType] = useState("");
  const [finalPrimarySource, setFinalPrimarySource] = useState("");
  const [primarySourceLevel, setPrimarySourceLevel] = useState("");
  const [primarySourceReason, setPrimarySourceReason] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [expertComment, setExpertComment] = useState("");
  const [isHighValue, setIsHighValue] = useState(false);
  const [shouldTrackLongTerm, setShouldTrackLongTerm] = useState(false);

  if (!open || !action) {
    return null;
  }

  function toggleTag(tag: EntityHintFeedbackTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function submit() {
    if (!action) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await submitEntityHintFeedbackAction({
        hintId,
        action,
        feedbackTags: selectedTags,
        notes: expertComment.trim() || undefined,
        expertComment: expertComment.trim() || undefined,
        finalEntityType: finalEntityType.trim() || undefined,
        finalPrimarySource: finalPrimarySource.trim() || undefined,
        mergeTarget: mergeTarget.trim() || undefined,
        primarySourceOverride: finalPrimarySource.trim()
          ? {
              url: finalPrimarySource.trim(),
              sourceLevel: primarySourceLevel.trim() || undefined,
              reason: primarySourceReason.trim() || undefined,
            }
          : undefined,
        isHighValue: isHighValue || undefined,
        shouldTrackLongTerm: shouldTrackLongTerm || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-feedback-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="entity-feedback-modal-title" className="text-sm font-semibold">
              Expert Feedback V2: {ACTION_LABELS[action]}
            </h2>
            {hintName ? <p className="mt-1 truncate text-xs text-zinc-500">{hintName}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="text-xs text-zinc-500">Reason tags</p>
            <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-auto rounded border border-zinc-200 p-2 dark:border-zinc-700">
              {ENTITY_HINT_FEEDBACK_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${
                      active
                        ? "border-sky-600 bg-sky-100 text-sky-900 dark:border-sky-500 dark:bg-sky-900/60 dark:text-sky-100"
                        : "border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {FEEDBACK_TAG_LABELS[tag]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-zinc-500">Final entity type</span>
              <select
                value={finalEntityType}
                onChange={(e) => setFinalEntityType(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="">Keep current</option>
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-zinc-500">Merge target</span>
              <input
                type="text"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                placeholder="Existing Entity / Candidate / Project name"
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <label className="block">
              <span className="text-xs text-zinc-500">Primary source override URL</span>
              <input
                type="url"
                value={finalPrimarySource}
                onChange={(e) => setFinalPrimarySource(e.target.value)}
                placeholder="https://github.com/... or https://huggingface.co/..."
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>

            <label className="block">
              <span className="text-xs text-zinc-500">Source level</span>
              <select
                value={primarySourceLevel}
                onChange={(e) => setPrimarySourceLevel(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="">Unchanged</option>
                <option value="primary">primary</option>
                <option value="primary_candidate">primary_candidate</option>
                <option value="secondary">secondary</option>
                <option value="secondary_evidence">secondary_evidence</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-zinc-500">Primary source reason</span>
            <input
              type="text"
              value={primarySourceReason}
              onChange={(e) => setPrimarySourceReason(e.target.value)}
              placeholder="Example: article is secondary, GitHub is the primary source"
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">Expert comment</span>
            <textarea
              value={expertComment}
              onChange={(e) => setExpertComment(e.target.value)}
              rows={4}
              placeholder="Explain the judgment. Example: This is a publisher name, not a project. Keep it as organization but do not promote to candidate."
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>

          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isHighValue}
                onChange={(e) => setIsHighValue(e.target.checked)}
              />
              High value
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={shouldTrackLongTerm}
                onChange={(e) => setShouldTrackLongTerm(e.target.checked)}
              />
              Track long term
            </label>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {pending ? "Submitting..." : "Submit feedback"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
            >
              Cancel
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}

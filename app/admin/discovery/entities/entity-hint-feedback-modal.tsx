"use client";

import { useState, useTransition } from "react";
import { submitEntityHintFeedbackAction } from "./actions";
import {
  ENTITY_HINT_FEEDBACK_TAGS,
  FEEDBACK_TAG_LABELS,
  type EntityHintFeedbackAction,
  type EntityHintFeedbackTag,
} from "@/lib/discovery/entity/feedback-types";

const ACTION_LABELS: Record<EntityHintFeedbackAction, string> = {
  ACCEPT: "ACCEPT · 接受",
  REJECT: "REJECT · 拒绝",
  UNSURE: "UNSURE · 不确定",
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<EntityHintFeedbackTag[]>([]);
  const [notes, setNotes] = useState("");
  const [feedbackReason, setFeedbackReason] = useState("");
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

  function submit(quick: boolean) {
    if (!action) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await submitEntityHintFeedbackAction({
        hintId,
        action,
        feedbackTags: quick ? [] : selectedTags,
        feedbackReason: quick ? undefined : feedbackReason.trim() || undefined,
        notes: quick ? undefined : notes.trim() || undefined,
        isHighValue: quick ? undefined : isHighValue || undefined,
        shouldTrackLongTerm: quick ? undefined : shouldTrackLongTerm || undefined,
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
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="entity-feedback-modal-title" className="text-sm font-semibold">
              专家反馈 · {ACTION_LABELS[action]}
            </h2>
            {hintName ? (
              <p className="mt-1 text-xs text-zinc-500 truncate">{hintName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
          快速提交仅记录 action；展开高级反馈可填写 tags、理由与 notes。重复提交会新增历史记录，不会覆盖。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(true)}
            className="rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "提交中…" : `快速提交 ${action}`}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setAdvancedOpen((v) => !v)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
          >
            {advancedOpen ? "收起高级反馈" : "展开高级反馈"}
          </button>
        </div>

        {advancedOpen ? (
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs text-zinc-500">feedbackTags（可选）</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
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

            <label className="block">
              <span className="text-xs text-zinc-500">feedbackReason（可选）</span>
              <input
                type="text"
                value={feedbackReason}
                onChange={(e) => setFeedbackReason(e.target.value)}
                placeholder="例如：真实实验室，与出版 AI 直接相关"
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>

            <label className="block">
              <span className="text-xs text-zinc-500">notes（可选）</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="补充说明、边界情况…"
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
                高价值实体
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={shouldTrackLongTerm}
                  onChange={(e) => setShouldTrackLongTerm(e.target.checked)}
                />
                长期跟踪
              </label>
            </div>

            <button
              type="button"
              disabled={pending}
              onClick={() => submit(false)}
              className="rounded border border-sky-600 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-900 disabled:opacity-50 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100"
            >
              {pending ? "提交中…" : `提交 ${action}（含高级字段）`}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}

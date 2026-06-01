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
  ACCEPT: "接受导入",
  REJECT: "拒绝导入",
  RETYPE: "修改实体类型",
  CHANGE_PRIMARY_SOURCE: "修改主来源",
  NEEDS_REVIEW: "待观察",
  UNSURE: "不确定",
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
  const [notes, setNotes] = useState("");
  const [feedbackReason, setFeedbackReason] = useState("");
  const [finalEntityType, setFinalEntityType] = useState("");
  const [finalPrimarySource, setFinalPrimarySource] = useState("");
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
        feedbackReason: feedbackReason.trim() || undefined,
        notes: notes.trim() || undefined,
        finalEntityType:
          action === "RETYPE" && finalEntityType.trim() ? finalEntityType.trim() : undefined,
        finalPrimarySource:
          action === "CHANGE_PRIMARY_SOURCE" && finalPrimarySource.trim()
            ? finalPrimarySource.trim()
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
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="entity-feedback-modal-title" className="text-sm font-semibold">
              Discovery 判断：{ACTION_LABELS[action]}
            </h2>
            {hintName ? <p className="mt-1 truncate text-xs text-zinc-500">{hintName}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            aria-label="关闭"
          >
            x
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-xs text-zinc-500">Reason Tags</p>
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

          {action === "RETYPE" ? (
            <label className="block">
              <span className="text-xs text-zinc-500">最终实体类型</span>
              <select
                value={finalEntityType}
                onChange={(e) => setFinalEntityType(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              >
                <option value="">请选择</option>
                {ENTITY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {action === "CHANGE_PRIMARY_SOURCE" ? (
            <label className="block">
              <span className="text-xs text-zinc-500">新的主来源 URL</span>
              <input
                type="url"
                value={finalPrimarySource}
                onChange={(e) => setFinalPrimarySource(e.target.value)}
                placeholder="https://github.com/... 或 https://huggingface.co/..."
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs text-zinc-500">判断说明（建议填写）</span>
            <input
              type="text"
              value={feedbackReason}
              onChange={(e) => setFeedbackReason(e.target.value)}
              placeholder="请说明判断依据"
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">补充备注</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="可为空"
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

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="rounded border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {pending ? "提交中..." : "提交判断"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="rounded border border-zinc-300 px-3 py-1.5 text-xs dark:border-zinc-600"
            >
              取消
            </button>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}

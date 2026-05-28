"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitEntityHintFeedbackAction } from "./actions";
import {
  ENTITY_HINT_FEEDBACK_TAGS,
  FEEDBACK_TAG_LABELS,
  type EntityHintFeedbackAction,
  type EntityHintFeedbackTag,
} from "@/lib/discovery/entity/feedback-types";

const ACTION_STYLES: Record<EntityHintFeedbackAction, string> = {
  ACCEPT:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  REJECT:
    "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
  UNSURE:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
};

const ACTION_LABELS: Record<EntityHintFeedbackAction, string> = {
  ACCEPT: "ACCEPT",
  REJECT: "REJECT",
  UNSURE: "UNSURE",
};

export function EntityHintFeedbackPanel({ hintId }: { hintId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedTags, setSelectedTags] = useState<EntityHintFeedbackTag[]>([]);
  const [notes, setNotes] = useState("");
  const [feedbackReason, setFeedbackReason] = useState("");
  const [isHighValue, setIsHighValue] = useState(false);
  const [shouldTrackLongTerm, setShouldTrackLongTerm] = useState(false);

  function toggleTag(tag: EntityHintFeedbackTag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function submit(action: EntityHintFeedbackAction) {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await submitEntityHintFeedbackAction({
        hintId,
        action,
        feedbackTags: selectedTags,
        feedbackReason: feedbackReason.trim() || undefined,
        notes: notes.trim() || undefined,
        isHighValue: isHighValue || undefined,
        shouldTrackLongTerm: shouldTrackLongTerm || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`已提交 ${action} 反馈`);
      setNotes("");
      setFeedbackReason("");
      setSelectedTags([]);
      setIsHighValue(false);
      setShouldTrackLongTerm(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900 dark:bg-sky-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-sky-900 dark:text-sky-100">
          专家反馈（E1.6）
        </h2>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-sky-700 underline dark:text-sky-300"
        >
          {expanded ? "收起选项" : "展开 tags / notes"}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        结构化沉淀判断理由，供未来 prompt / ranking / fine-tuning 使用。
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["ACCEPT", "REJECT", "UNSURE"] as const).map((action) => (
          <button
            key={action}
            type="button"
            disabled={pending}
            onClick={() => submit(action)}
            className={`rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${ACTION_STYLES[action]}`}
          >
            {pending ? "提交中…" : ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {expanded ? (
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
            <span className="text-xs text-zinc-500">简短理由 feedbackReason（可选）</span>
            <input
              type="text"
              value={feedbackReason}
              onChange={(e) => setFeedbackReason(e.target.value)}
              placeholder="例如：真实实验室，与出版 AI 直接相关"
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
            />
          </label>

          <label className="block">
            <span className="text-xs text-zinc-500">notes（可选）</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="补充说明、边界情况…"
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-900"
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
        </div>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      {message ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>
      ) : null}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MentorReviewForm({ groupId, taskId }: { groupId: string; taskId: string }) {
  const router = useRouter();
  const [strengths, setStrengths] = useState("");
  const [issues, setIssues] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [recommendFinalPresentation, setRecommendFinalPresentation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    const content = [strengths, issues, suggestions, nextSteps].filter(Boolean).join("\n\n");
    try {
      const res = await fetch("/api/training/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          taskId,
          type: "mentor_review",
          title: "导师点评",
          content,
          contentJson: {
            strengths,
            issues,
            suggestions,
            nextSteps,
            recommendFinalPresentation,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "保存失败，请稍后重试。");
        return;
      }
      setStrengths("");
      setIssues("");
      setSuggestions("");
      setNextSteps("");
      setRecommendFinalPresentation(false);
      setMessage("导师点评已保存。");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="优点" value={strengths} onChange={setStrengths} />
        <Field label="主要问题" value={issues} onChange={setIssues} />
        <Field label="建议补充" value={suggestions} onChange={setSuggestions} />
        <Field label="下一步修改方向" value={nextSteps} onChange={setNextSteps} />
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={recommendFinalPresentation}
          onChange={(event) => setRecommendFinalPresentation(event.target.checked)}
        />
        建议进入最终汇报
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
      >
        {submitting ? "保存中..." : "保存导师点评"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}

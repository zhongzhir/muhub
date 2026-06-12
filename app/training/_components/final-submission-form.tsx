"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FinalSubmissionForm({
  groupId,
  taskId,
  initialTitle,
  initialContent,
}: {
  groupId: string;
  taskId?: string;
  initialTitle?: string;
  initialContent?: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [content, setContent] = useState(initialContent ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/training/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          taskId: taskId ?? null,
          type: "final_submission",
          title,
          content,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "保存失败，请稍后重试。");
        return;
      }
      setMessage("最终成果已保存。");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-5 dark:border-teal-900 dark:bg-teal-950/20">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">最终成果提交</h2>
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <label className="block text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">最终成果标题</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">最终成果摘要</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={4}
          required
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400"
      >
        {submitting ? "保存中..." : "保存最终成果"}
      </button>
    </form>
  );
}

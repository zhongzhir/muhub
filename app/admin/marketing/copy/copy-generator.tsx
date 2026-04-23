"use client";

import { useState } from "react";

function CopyButton({ text }: { text: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setMessage("已复制");
          } catch {
            setMessage("复制失败");
          }
          setTimeout(() => setMessage(""), 1200);
        }}
      >
        复制
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}

export function MarketingCopyGenerator({ projectId }: { projectId: string }) {
  const [mode, setMode] = useState<"social" | "article">("social");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [content, setContent] = useState("");

  const generate = async () => {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/marketing-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        content?: string;
      };
      if (!response.ok || !data.ok || !data.content) {
        throw new Error(data.error || "生成失败");
      }
      setContent(data.content);
      setMessage("内容已生成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成失败");
    } finally {
      setPending(false);
    }
  };

  const articleParagraphs = content
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value === "article" ? "article" : "social")}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="social">社交文案</option>
          <option value="article">公众号文章</option>
        </select>
        <button type="button" onClick={generate} disabled={pending} className="muhub-btn-primary px-3 py-2 text-sm disabled:opacity-60">
          {pending ? "生成中..." : "生成内容"}
        </button>
      </div>

      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            content
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </p>
      ) : null}

      {!content ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40">
          暂无生成内容，请先选择模式并点击“生成内容”。
        </p>
      ) : mode === "social" ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-xs text-zinc-500">社交文案</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{content}</p>
          <div className="mt-3 flex items-center gap-3">
            <CopyButton text={content} />
            <span className="text-xs text-zinc-500">约 {content.length} 字</span>
          </div>
        </div>
      ) : (
        <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">公众号文章（Markdown 视图）</p>
            <CopyButton text={content} />
          </div>
          <div className="space-y-4 text-sm leading-7 text-zinc-800 dark:text-zinc-200">
            {articleParagraphs.map((paragraph) => (
              <p key={paragraph} className="whitespace-pre-wrap">{paragraph}</p>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}

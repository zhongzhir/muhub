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
  const [tone, setTone] = useState<"balanced" | "expressive">("balanced");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [content, setContent] = useState("");
  const [hookLine, setHookLine] = useState("");
  const [titleCandidates, setTitleCandidates] = useState<string[]>([]);
  const [summaryNotes, setSummaryNotes] = useState<string[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [copyAllMessage, setCopyAllMessage] = useState("");

  const generate = async () => {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/marketing-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, tone }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        mode?: "social" | "article";
        tone?: "balanced" | "expressive";
        content?: string;
        hookLine?: string;
        titleCandidates?: string[];
        summaryNotes?: string[];
        sourceBasis?: { hasOfficialInfo?: boolean; hasAiInsight?: boolean; usedFields?: string[] };
      };
      if (!response.ok || !data.ok || !data.content) {
        throw new Error(data.error || "生成失败");
      }
      setContent(data.content);
      setHookLine(data.hookLine || "");
      setTitleCandidates(Array.isArray(data.titleCandidates) ? data.titleCandidates : []);
      setSummaryNotes(Array.isArray(data.summaryNotes) ? data.summaryNotes : []);
      const sourceParts = [
        data.sourceBasis?.hasOfficialInfo ? "官方信息" : "",
        data.sourceBasis?.hasAiInsight ? "AI结构化分析" : "",
        (data.sourceBasis?.usedFields ?? []).some((field) => field.includes("github") || field.includes("website"))
          ? "GitHub与来源事实"
          : "",
      ].filter(Boolean);
      setSourceText(sourceParts.length ? sourceParts.join(" / ") : "项目结构字段");
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

  const copyAll = async () => {
    if (!content) {
      setCopyAllMessage("暂无可复制内容。");
      return;
    }
    const full = [
      titleCandidates.length ? `标题候选：\n${titleCandidates.map((t, i) => `${i + 1}. ${t}`).join("\n")}` : "",
      hookLine ? `开头钩子：${hookLine}` : "",
      "正文：",
      content,
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(full);
      setCopyAllMessage("已复制全文。");
    } catch {
      setCopyAllMessage("复制失败，请重试。");
    }
    setTimeout(() => setCopyAllMessage(""), 1500);
  };

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
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value === "expressive" ? "expressive" : "balanced")}
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <option value="balanced">平衡表达（balanced）</option>
          <option value="expressive">强表达（expressive）</option>
        </select>
        <button type="button" onClick={generate} disabled={pending} className="muhub-btn-primary px-3 py-2 text-sm disabled:opacity-60">
          {pending ? "生成中..." : "生成内容"}
        </button>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
        当前模式：{mode === "article" ? "公众号文章" : "社交文案"} ｜ 当前调性：{tone} ｜ 输入来源：{sourceText || "未生成"}
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">社交文案</p>
            <button
              type="button"
              onClick={copyAll}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              复制全文
            </button>
          </div>
          {copyAllMessage ? <p className="mb-2 text-xs text-zinc-500">{copyAllMessage}</p> : null}
          {hookLine ? (
            <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="text-xs opacity-80">开头钩子</p>
              <p className="mt-1">{hookLine}</p>
            </div>
          ) : null}
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
            <button
              type="button"
              onClick={copyAll}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              复制全文
            </button>
          </div>
          {copyAllMessage ? <p className="mb-2 text-xs text-zinc-500">{copyAllMessage}</p> : null}
          {titleCandidates.length ? (
            <div className="mb-4 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
              <p className="text-xs text-zinc-500">标题候选</p>
              <ul className="mt-2 space-y-2">
                {titleCandidates.map((title) => (
                  <li key={title} className="flex items-center justify-between gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                    <span>{title}</span>
                    <CopyButton text={title} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-4 text-sm leading-7 text-zinc-800 dark:text-zinc-200">
            {articleParagraphs.map((paragraph) => (
              <p key={paragraph} className="whitespace-pre-wrap">{paragraph}</p>
            ))}
          </div>
        </article>
      )}
      {summaryNotes.length ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
          <p className="font-medium">生成说明</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {summaryNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

type SubmitResult =
  | {
      ok: true;
      itemId: string;
      title: string;
      extractedUrl: string | null;
      isWechatArticle: boolean;
      duplicate?: boolean;
      autoExtraction?:
        | { attempted: false; reason: "duplicate" | "no_url" }
        | {
            attempted: true;
            ok: true;
            articleTitle: string | null;
            totalExtracted: number;
            queued: { success: number; duplicate: number; failed: number };
          }
        | { attempted: true; ok: false; error: string };
    }
  | { ok: false; error: string };

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function MobileCaptureForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<SubmitResult | null>(null);

  function submit() {
    setFeedback(null);
    startTransition(() => {
      void (async () => {
        const resp = await fetch("/api/admin/discovery/mobile-capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || undefined,
            content,
            sourceNote: sourceNote.trim() || undefined,
          }),
        });
        const data = (await resp.json()) as SubmitResult;
        if (!resp.ok || !data.ok) {
          setFeedback(data.ok ? { ok: false, error: "保存失败" } : data);
          return;
        }
        setFeedback(data);
        setTitle("");
        setContent("");
        setSourceNote("");
      })();
    });
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <div
          role="status"
          className={
            feedback.ok
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }
        >
          {feedback.ok ? (
            <div className="space-y-1">
              <p>
                已保存到手机采集箱，待提取项目{feedback.duplicate ? "，已有相同链接记录未重复写入" : ""}。
              </p>
              <p className="text-xs">
                {feedback.extractedUrl ? `URL: ${feedback.extractedUrl}` : "未检测到 URL"}
                {feedback.isWechatArticle ? " · 微信公众号文章" : ""}
              </p>
              {feedback.autoExtraction?.attempted ? (
                feedback.autoExtraction.ok ? (
                  <p className="text-xs">
                    自动提取：识别 {feedback.autoExtraction.totalExtracted} 个，新增队列{" "}
                    {feedback.autoExtraction.queued.success} 个，重复{" "}
                    {feedback.autoExtraction.queued.duplicate} 个，失败{" "}
                    {feedback.autoExtraction.queued.failed} 个。
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    自动提取失败：{feedback.autoExtraction.error}
                  </p>
                )
              ) : null}
              <div className="flex flex-wrap gap-3 text-xs">
                <Link href="/admin/discovery/items" className="inline-block underline underline-offset-4">
                  去 JSON 队列/批量提取项目
                </Link>
                <Link href="/admin/discovery?material=source_material" className="inline-block underline underline-offset-4">
                  查看待提取素材
                </Link>
              </div>
            </div>
          ) : (
            feedback.error
          )}
        </div>
      ) : null}

      <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        标题
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
          placeholder="可选：文章标题 / 项目线索标题"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        内容
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={`${inputClass} min-h-[260px] resize-y`}
          placeholder="粘贴公众号文章链接、网页链接、文章正文，或“标题 + 链接 + 正文”的混合内容。"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        来源备注
        <input
          value={sourceNote}
          onChange={(e) => setSourceNote(e.target.value)}
          className={inputClass}
          placeholder="例如：微信公众号、朋友圈、WPS、浏览器、飞书等"
        />
      </label>

      <button
        type="button"
        disabled={pending || !content.trim()}
        onClick={submit}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "保存中..." : "保存到采集箱"}
      </button>
    </div>
  );
}

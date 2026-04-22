"use client";

import { useState } from "react";

export function PosterTools({
  projectId,
  filename,
}: {
  projectId: string;
  filename: string;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const mark = async (mode: "print" | "download") => {
    await fetch("/api/admin/marketing/posters/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ projectId, mode }),
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="muhub-btn-secondary px-3 py-2 text-sm disabled:opacity-60"
        onClick={async () => {
          setPending(true);
          setMessage("");
          try {
            await mark("print");
            window.print();
            setMessage("已打开打印窗口。");
          } catch {
            setMessage("打印失败，请重试。");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "处理中..." : "打印"}
      </button>
      <button
        type="button"
        disabled={pending}
        className="muhub-btn-secondary px-3 py-2 text-sm disabled:opacity-60"
        onClick={async () => {
          setPending(true);
          setMessage("");
          try {
            await mark("download");
            const html = document.documentElement.outerHTML;
            const blob = new Blob([html], { type: "text/html;charset=utf-8" });
            const href = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = href;
            a.download = `${filename}.html`;
            a.click();
            URL.revokeObjectURL(href);
            setMessage("已下载 HTML 海报。");
          } catch {
            setMessage("下载失败，请重试。");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "处理中..." : "下载"}
      </button>
      {message ? <span className="text-xs text-zinc-500">{message}</span> : null}
    </div>
  );
}

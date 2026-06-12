"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function FileUploadPanel({
  groupId,
  taskId,
}: {
  groupId: string;
  taskId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setMessage("请选择要上传的文件。");
      return;
    }

    setIsUploading(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("groupId", groupId);
    if (taskId) formData.set("taskId", taskId);
    formData.set("kind", "task_file");

    try {
      const res = await fetch("/api/training/files", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error || "上传失败，请稍后重试。");
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      setMessage("文件已上传。");
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          type="file"
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:text-zinc-300 dark:file:bg-zinc-100 dark:file:text-zinc-900"
        />
        <button
          type="button"
          onClick={upload}
          disabled={isUploading}
          className="inline-flex shrink-0 justify-center rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400"
        >
          {isUploading ? "上传中" : "上传文件"}
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        支持 PDF、Office 文档、图片、Markdown、CSV、TXT 和 ZIP，单个文件不超过 50MB。
      </p>
    </div>
  );
}

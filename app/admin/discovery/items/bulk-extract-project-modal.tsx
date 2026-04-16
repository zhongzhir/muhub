"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  bulkAddGithubProjectsToQueueAction,
  extractGithubProjectsFromArticleAction,
} from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

type ExtractedItem = {
  githubUrl: string;
  owner: string;
  repo: string;
  projectName: string;
  summary: string | null;
  stars: number;
  language: string | null;
  websiteUrl: string | null;
  status: "ready" | "duplicate" | "error";
  errorMessage?: string;
  duplicateProject?: { slug: string; name: string } | null;
};

export function BulkExtractProjectModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sourceName, setSourceName] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [items, setItems] = useState<ExtractedItem[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<string[]>([]);

  const readyItems = useMemo(() => items.filter((x) => x.status === "ready"), [items]);

  function reset() {
    setSourceName("");
    setArticleTitle("");
    setArticleBody("");
    setFeedback(null);
    setItems([]);
    setSelectedUrls([]);
  }

  function toggleSelect(url: string) {
    setSelectedUrls((prev) => (prev.includes(url) ? prev.filter((x) => x !== url) : [...prev, url]));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        批量提取项目
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-5xl rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">批量提取项目</h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  粘贴公众号文章正文，自动提取 GitHub 项目并批量加入发现队列。
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                关闭
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                来源名称（可选）
                <input
                  className={inputClass}
                  placeholder="例如：某某公众号"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                文章来源标题（可选）
                <input
                  className={inputClass}
                  placeholder="文章标题"
                  value={articleTitle}
                  onChange={(e) => setArticleTitle(e.target.value)}
                />
              </label>
              <label className="text-sm">
                文章正文（必填）
                <textarea
                  className={`${inputClass} min-h-[200px]`}
                  placeholder="粘贴公众号文章正文..."
                  value={articleBody}
                  onChange={(e) => setArticleBody(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className="rounded bg-zinc-900 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                onClick={() => {
                  setFeedback(null);
                  startTransition(() => {
                    void (async () => {
                      const result = await extractGithubProjectsFromArticleAction({
                        sourceName: sourceName.trim() || undefined,
                        articleTitle: articleTitle.trim() || undefined,
                        articleBody,
                      });
                      if (!result.ok) {
                        setItems([]);
                        setSelectedUrls([]);
                        setFeedback({ kind: "err", text: result.error });
                        return;
                      }
                      setItems(result.items);
                      const defaultSelected = result.items
                        .filter((x) => x.status === "ready")
                        .map((x) => x.githubUrl);
                      setSelectedUrls(defaultSelected);
                      setFeedback({
                        kind: "ok",
                        text: `提取完成：原始链接 ${result.totalUrls}，仓库去重后 ${result.uniqueRepoUrls}。`,
                      });
                    })();
                  });
                }}
              >
                {pending ? "提取中..." : "提取 GitHub 项目"}
              </button>

              <button
                type="button"
                disabled={pending || selectedUrls.length === 0}
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                onClick={() => {
                  setFeedback(null);
                  startTransition(() => {
                    void (async () => {
                      const result = await bulkAddGithubProjectsToQueueAction({
                        sourceName: sourceName.trim() || undefined,
                        articleTitle: articleTitle.trim() || undefined,
                        articleBody,
                        selectedGithubUrls: selectedUrls,
                      });
                      if (!result.ok) {
                        setFeedback({ kind: "err", text: result.error });
                        return;
                      }
                      setFeedback({ kind: "ok", text: result.message });
                      router.refresh();
                    })();
                  });
                }}
              >
                {pending ? "处理中..." : "批量加入发现队列"}
              </button>
            </div>

            {feedback ? (
              <p
                className={`mt-4 rounded px-3 py-2 text-xs ${
                  feedback.kind === "ok"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                    : "border border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                }`}
              >
                {feedback.text}
              </p>
            ) : null}

            {items.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/30">
                    <tr>
                      <th className="px-3 py-2">选择</th>
                      <th className="px-3 py-2">GitHub URL</th>
                      <th className="px-3 py-2">项目名</th>
                      <th className="px-3 py-2">简介</th>
                      <th className="px-3 py-2">Stars</th>
                      <th className="px-3 py-2">语言</th>
                      <th className="px-3 py-2">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const checked = selectedUrls.includes(item.githubUrl);
                      const disabled = item.status !== "ready";
                      return (
                        <tr key={item.githubUrl} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleSelect(item.githubUrl)}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <a href={item.githubUrl} target="_blank" rel="noreferrer" className="underline">
                              {item.githubUrl}
                            </a>
                          </td>
                          <td className="px-3 py-2">{item.projectName || "-"}</td>
                          <td className="px-3 py-2 max-w-[320px] truncate">{item.summary || "-"}</td>
                          <td className="px-3 py-2">{item.stars}</td>
                          <td className="px-3 py-2">{item.language || "-"}</td>
                          <td className="px-3 py-2">
                            {item.status === "ready" ? (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                可加入
                              </span>
                            ) : item.status === "duplicate" ? (
                              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                已存在
                              </span>
                            ) : (
                              <span className="rounded bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-950 dark:text-red-200">
                                解析失败
                              </span>
                            )}
                            {item.status === "duplicate" && item.duplicateProject ? (
                              <p className="mt-1">
                                <Link
                                  href={`/projects/${item.duplicateProject.slug}`}
                                  className="underline underline-offset-2"
                                >
                                  {item.duplicateProject.name}
                                </Link>
                              </p>
                            ) : null}
                            {item.status === "error" && item.errorMessage ? (
                              <p className="mt-1 text-red-600 dark:text-red-300">{item.errorMessage}</p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  可加入：{readyItems.length}，已选：{selectedUrls.length}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  addManualGithubToQueueAction,
  importManualGithubProjectAction,
  parseManualGithubProjectAction,
} from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-blue-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

type ParsedState = {
  githubUrl: string;
  owner: string;
  repo: string;
  title: string;
  summary: string | null;
  homepage: string | null;
  stargazersCount: number;
  language: string | null;
  duplicate: { slug: string; name: string } | null;
};

export function ManualAddProjectModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [githubUrl, setGithubUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [note, setNote] = useState("");
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const duplicateHit = parsed?.duplicate ?? null;
  const canSubmit = Boolean(parsed && !duplicateHit);

  const normalizedWebsite = useMemo(() => websiteUrl.trim(), [websiteUrl]);

  function resetForm() {
    setGithubUrl("");
    setWebsiteUrl("");
    setNote("");
    setParsed(null);
    setFeedback(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setFeedback(null);
        }}
        className="rounded border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        ➕ 添加项目
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  一键添加项目（GitHub URL）
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  粘贴 GitHub URL，自动解析并选择加入发现队列或直接导入项目。
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                关闭
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                GitHub URL（必填）
                <input
                  className={inputClass}
                  placeholder="https://github.com/{owner}/{repo}"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
              </label>
              <label className="text-sm">
                官网 URL（可选）
                <input
                  className={inputClass}
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </label>
              <label className="text-sm">
                备注（可选）
                <textarea
                  className={`${inputClass} min-h-[72px]`}
                  placeholder="运营备注"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
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
                      const result = await parseManualGithubProjectAction({
                        githubUrl: githubUrl.trim(),
                        websiteUrl: normalizedWebsite || undefined,
                      });
                      if (!result.ok) {
                        setParsed(null);
                        setFeedback({ kind: "err", text: result.error });
                        return;
                      }
                      setParsed({
                        githubUrl: result.parsed.githubUrl,
                        owner: result.parsed.owner,
                        repo: result.parsed.repo,
                        title: result.parsed.title,
                        summary: result.parsed.summary,
                        homepage: result.parsed.homepage,
                        stargazersCount: result.parsed.stargazersCount,
                        language: result.parsed.language,
                        duplicate: result.duplicate
                          ? { slug: result.duplicate.slug, name: result.duplicate.name }
                          : null,
                      });
                      if (result.duplicate) {
                        setFeedback({ kind: "err", text: "该项目已存在，禁止重复导入。" });
                      } else {
                        setFeedback({ kind: "ok", text: "解析成功，可加入发现队列或直接导入项目。" });
                      }
                    })();
                  });
                }}
              >
                {pending ? "解析中..." : "解析项目"}
              </button>

              <button
                type="button"
                disabled={pending || !canSubmit}
                className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                onClick={() => {
                  if (!parsed) {
                    return;
                  }
                  setFeedback(null);
                  startTransition(() => {
                    void (async () => {
                      const result = await addManualGithubToQueueAction({
                        githubUrl: parsed.githubUrl,
                        websiteUrl: normalizedWebsite || parsed.homepage || undefined,
                        note,
                        title: parsed.title,
                        summary: parsed.summary,
                        owner: parsed.owner,
                        repo: parsed.repo,
                        language: parsed.language,
                        stargazersCount: parsed.stargazersCount,
                      });
                      if (!result.ok) {
                        setFeedback({ kind: "err", text: result.error });
                        return;
                      }
                      setFeedback({ kind: "ok", text: "已加入发现队列。" });
                      router.refresh();
                    })();
                  });
                }}
              >
                {pending ? "处理中..." : "加入发现队列"}
              </button>

              <button
                type="button"
                disabled={pending || !canSubmit}
                className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                onClick={() => {
                  if (!parsed) {
                    return;
                  }
                  setFeedback(null);
                  startTransition(() => {
                    void (async () => {
                      const result = await importManualGithubProjectAction({
                        githubUrl: parsed.githubUrl,
                        websiteUrl: normalizedWebsite || parsed.homepage || undefined,
                        note,
                        title: parsed.title,
                        summary: parsed.summary,
                        owner: parsed.owner,
                        repo: parsed.repo,
                        language: parsed.language,
                        stargazersCount: parsed.stargazersCount,
                      });
                      if (!result.ok) {
                        setFeedback({ kind: "err", text: result.error });
                        return;
                      }
                      setFeedback({ kind: "ok", text: "已成功导入项目。" });
                      router.refresh();
                    })();
                  });
                }}
              >
                {pending ? "导入中..." : "直接导入项目"}
              </button>
            </div>

            {parsed ? (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-300">
                <p>项目：{parsed.title}</p>
                <p>仓库：{parsed.owner}/{parsed.repo}</p>
                <p>Stars：{parsed.stargazersCount}</p>
                <p>语言：{parsed.language || "-"}</p>
                <p className="truncate">GitHub URL：{parsed.githubUrl}</p>
                <p className="truncate">官网 URL：{normalizedWebsite || parsed.homepage || "-"}</p>
                {parsed.summary ? <p className="mt-1 line-clamp-2">简介：{parsed.summary}</p> : null}
                {duplicateHit ? (
                  <p className="mt-2 text-red-600 dark:text-red-300">
                    该项目已存在：
                    <Link href={`/projects/${duplicateHit.slug}`} className="underline underline-offset-2">
                      {duplicateHit.name}
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}

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
          </div>
        </div>
      ) : null}
    </>
  );
}

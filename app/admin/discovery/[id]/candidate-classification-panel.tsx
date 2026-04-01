"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type ClassificationJobSummary = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
};

export function CandidateClassificationPanel(props: {
  candidateId: string;
  classificationStatus: string;
  suggestedType: string | null;
  suggestedTags: string[];
  classificationScore: number | null;
  evidence: string[];
  isAiRelated: boolean | null;
  isChineseTool: boolean | null;
  formalCategories: string[];
  lastJob: ClassificationJobSummary | null;
}) {
  const {
    candidateId,
    classificationStatus,
    suggestedType,
    suggestedTags,
    classificationScore,
    evidence,
    isAiRelated,
    isChineseTool,
    formalCategories,
    lastJob,
  } = props;

  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const runClassify = () => {
    setMessage(null);
    start(async () => {
      const res = await fetch(
        `/api/admin/discovery/candidates/${candidateId}/classify`,
        { method: "POST", credentials: "include" },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string; jobId?: string };
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setMessage(`分类完成 · job ${json.jobId ?? "—"}`);
      router.refresh();
    });
  };

  const accept = () => {
    setMessage(null);
    start(async () => {
      const res = await fetch(
        `/api/admin/discovery/candidates/${candidateId}/accept-classification`,
        { method: "POST", credentials: "include" },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        categoriesAppended?: boolean;
        tagsMergedCount?: number;
      };
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setMessage(
        `已接受：类目追加 ${json.categoriesAppended ? "是" : "否"}，新标签 ${json.tagsMergedCount ?? 0} 个`,
      );
      router.refresh();
    });
  };

  const canAccept = classificationStatus === "DONE";

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Classification（规则 V1）
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            状态 {classificationStatus} · 仅规则与关键词 / topics，无大模型。接受后将建议合并入正式类目与标签（仅补缺，不覆盖已有）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={runClassify}
            className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-violet-600"
          >
            Run Classification
          </button>
          <button
            type="button"
            disabled={pending || !canAccept}
            onClick={accept}
            className="rounded-lg border border-violet-400 px-3 py-1.5 text-xs font-medium text-violet-900 disabled:opacity-50 dark:border-violet-600 dark:text-violet-200"
            title={canAccept ? undefined : "需先运行分类且状态为 DONE"}
          >
            Accept Classification
          </button>
        </div>
      </div>

      {lastJob ? (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          最近任务：{lastJob.status}
          {lastJob.finishedAt ?
            ` · ${new Date(lastJob.finishedAt).toLocaleString()}`
          : " · 进行中"}
          {lastJob.errorMessage ?
            <span className="ml-1 text-red-600 dark:text-red-400">· {lastJob.errorMessage}</span>
          : null}
        </p>
      ) : null}

      {message ? (
        <p className="mt-2 rounded border border-zinc-200 bg-violet-50 px-2 py-1 text-xs dark:border-violet-900/50 dark:bg-violet-950/30">
          {message}
        </p>
      ) : null}

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-zinc-500">建议主类型</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {suggestedType ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">相关度分</dt>
          <dd className="tabular-nums">{classificationScore ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">isAiRelated / isChineseTool</dt>
          <dd>
            {String(isAiRelated ?? "—")} / {String(isChineseTool ?? "—")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">正式类目（categoriesJson）</dt>
          <dd className="text-zinc-700 dark:text-zinc-300">
            {formalCategories.length ? formalCategories.join(" · ") : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="text-xs text-zinc-500">建议标签</p>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
          {suggestedTags.length ? suggestedTags.map((t) => `#${t}`).join("  ") : "—"}
        </p>
      </div>

      {evidence.length ? (
        <div className="mt-3">
          <h3 className="text-xs font-medium text-zinc-500">命中依据（节选）</h3>
          <ul className="mt-1 max-h-40 list-inside list-disc overflow-auto text-xs text-zinc-600 dark:text-zinc-400">
            {evidence.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">尚无依据（未运行分类或无命中）。</p>
      )}
    </section>
  );
}

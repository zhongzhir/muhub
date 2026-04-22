"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  convertSignalToCandidateWithAiAction,
  generateSignalAiInsightAction,
} from "./ai-actions";
import type { SignalAiInsight } from "@/lib/discovery/signal-ai-insight";
import { normalizePrimaryCategoryToSlug } from "@/lib/projects/project-categories";

function projectLevelBadgeClass(level: SignalAiInsight["likelyProject"]): string {
  if (level === "HIGH") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (level === "MEDIUM") {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  return "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300";
}

export function SignalAiInsightPanel({ signalId }: { signalId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [insight, setInsight] = useState<SignalAiInsight | null>(null);
  const [acceptedName, setAcceptedName] = useState<string | null>(null);
  const [acceptedCategory, setAcceptedCategory] = useState<string | null>(null);
  const [acceptedSimpleSummary, setAcceptedSimpleSummary] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              setMessage(null);
              const result = await generateSignalAiInsightAction(signalId);
              if (!result.ok) {
                setInsight(null);
                setError(result.error);
                return;
              }
              setInsight(result.insight);
              setAcceptedName(null);
              setAcceptedCategory(null);
              setAcceptedSimpleSummary(null);
            })
          }
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200"
        >
          {pending ? "生成中..." : "生成分析"}
        </button>
        <span className="text-xs text-zinc-500">AI 仅辅助判断，不会自动执行转化或状态变更。</span>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}

      {insight ? (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          <p>
            <span className="text-zinc-500">项目可能性：</span>
            <span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${projectLevelBadgeClass(insight.likelyProject)}`}>
              {insight.likelyProject}
            </span>
          </p>
          <p>
            <span className="text-zinc-500">建议项目名：</span>
            <span className="ml-2">{insight.suggestedName || "—"}</span>
            {insight.suggestedName ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setAcceptedName(insight.suggestedName || null);
                  setMessage("已采纳建议项目名。");
                }}
                className="ml-3 rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600"
              >
                采纳为项目名
              </button>
            ) : null}
          </p>
          <p>
            <span className="text-zinc-500">通俗说明：</span>
            <span className="ml-2">{insight.suggestedSummary || "—"}</span>
            {insight.suggestedSummary ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setAcceptedSimpleSummary(insight.suggestedSummary || null);
                  setMessage("已采纳通俗说明。");
                }}
                className="ml-3 rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600"
              >
                采纳为通俗介绍
              </button>
            ) : null}
          </p>
          <p>
            <span className="text-zinc-500">建议分类：</span>
            <span className="ml-2">{insight.suggestedCategory || "—"}</span>
            {insight.suggestedCategory ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const normalized = normalizePrimaryCategoryToSlug(insight.suggestedCategory);
                  if (!normalized) {
                    setError("建议分类无法映射为系统分类，请手动处理。");
                    return;
                  }
                  setAcceptedCategory(normalized);
                  setMessage(`已采纳建议分类：${normalized}`);
                }}
                className="ml-3 rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600"
              >
                采纳为分类
              </button>
            ) : null}
          </p>
          <p>
            <span className="text-zinc-500">建议动作：</span>
            <span className="ml-2">{insight.recommendation || "—"}</span>
          </p>
          <div className="rounded border border-zinc-200 bg-white p-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
            已采纳（仅当前页面临时状态）：
            <span className="ml-2">项目名：{acceptedName || "—"}</span>
            <span className="ml-3">分类：{acceptedCategory || "—"}</span>
            <span className="ml-3">通俗介绍：{acceptedSimpleSummary ? "已采纳" : "—"}</span>
          </div>
          <div>
            <p className="text-zinc-500">原因列表：</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {insight.reasons.map((reason, idx) => (
                <li key={`${reason}-${idx}`}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="pt-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const confirmed = window.confirm("确认使用 AI 建议创建候选项目？");
                if (!confirmed) {
                  return;
                }
                start(async () => {
                  setError(null);
                  setMessage(null);
                  const result = await convertSignalToCandidateWithAiAction(signalId, insight, {
                    acceptedName,
                    acceptedCategory,
                    acceptedSimpleSummary,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setMessage("已按 AI 建议创建候选项目。");
                  router.push(`/admin/discovery/${result.candidateId}`);
                });
              }}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {pending ? "处理中..." : "按 AI 建议转为候选项目"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

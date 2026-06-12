"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function ScoreField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <select
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className={inputClass}
      >
        {[1, 2, 3, 4, 5].map((score) => (
          <option key={score} value={score}>
            {score} 分
          </option>
        ))}
      </select>
    </label>
  );
}

export function SurveyForm({
  identity,
  initialValue,
}: {
  identity: {
    name: string;
    classLabel: string;
    groupLabel: string;
    roleLabel: string;
  };
  initialValue?: {
    caseQualityScore: number;
    mentorScore: number;
    platformScore: number;
    mostValuablePart: string;
    improvementPart: string;
    willingToContinue: boolean;
    muhubSuggestion: string;
  };
}) {
  const router = useRouter();
  const [caseQualityScore, setCaseQualityScore] = useState(initialValue?.caseQualityScore ?? 5);
  const [mentorScore, setMentorScore] = useState(initialValue?.mentorScore ?? 5);
  const [platformScore, setPlatformScore] = useState(initialValue?.platformScore ?? 5);
  const [mostValuablePart, setMostValuablePart] = useState(initialValue?.mostValuablePart ?? "");
  const [improvementPart, setImprovementPart] = useState(initialValue?.improvementPart ?? "");
  const [willingToContinue, setWillingToContinue] = useState(initialValue?.willingToContinue ?? true);
  const [muhubSuggestion, setMuhubSuggestion] = useState(initialValue?.muhubSuggestion ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setMessage(null);
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/training/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseQualityScore,
          mentorScore,
          platformScore,
          mostValuablePart,
          improvementPart,
          willingToContinue,
          muhubSuggestion,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; mode?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "提交失败，请稍后重试。");
        return;
      }
      setMessage(data.mode === "updated" ? "调查问卷已更新。" : "调查问卷已提交。");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-4 rounded-xl border border-zinc-100 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/40 sm:grid-cols-4">
        <div>
          <div className="text-zinc-500">姓名</div>
          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">{identity.name}</div>
        </div>
        <div>
          <div className="text-zinc-500">身份</div>
          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">{identity.roleLabel}</div>
        </div>
        <div>
          <div className="text-zinc-500">班级</div>
          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">{identity.classLabel}</div>
        </div>
        <div>
          <div className="text-zinc-500">小组</div>
          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-50">{identity.groupLabel}</div>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <ScoreField label="案例质量评分" value={caseQualityScore} onChange={setCaseQualityScore} />
        <ScoreField label="导师指导评分" value={mentorScore} onChange={setMentorScore} />
        <ScoreField label="平台使用评分" value={platformScore} onChange={setPlatformScore} />
      </div>

      <label className="block text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">最有收获的环节 *</span>
        <textarea
          value={mostValuablePart}
          onChange={(event) => setMostValuablePart(event.target.value)}
          rows={4}
          required
          className={inputClass}
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">最需要改进的环节 *</span>
        <textarea
          value={improvementPart}
          onChange={(event) => setImprovementPart(event.target.value)}
          rows={4}
          required
          className={inputClass}
        />
      </label>

      <fieldset className="text-sm">
        <legend className="font-medium text-zinc-700 dark:text-zinc-300">是否愿意继续参与后续交流 *</legend>
        <div className="mt-2 flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={willingToContinue === true}
              onChange={() => setWillingToContinue(true)}
            />
            愿意
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={willingToContinue === false}
              onChange={() => setWillingToContinue(false)}
            />
            暂不考虑
          </label>
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">对 MUHUB / training.muhub.cn 的建议</span>
        <textarea
          value={muhubSuggestion}
          onChange={(event) => setMuhubSuggestion(event.target.value)}
          rows={4}
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-teal-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800 disabled:opacity-60 dark:bg-teal-500 dark:hover:bg-teal-400"
      >
        {submitting ? "提交中..." : "提交满意度调查"}
      </button>
    </form>
  );
}

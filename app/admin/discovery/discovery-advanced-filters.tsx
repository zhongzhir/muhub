"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mergeAdminCandidateListUrl } from "@/lib/discovery/admin-candidate-list-url";
import { DISCOVERY_CLASSIFICATION_STATUSES } from "@/lib/discovery/candidate-list-query";
import { PRIMARY_TYPE_ORDER } from "@/lib/discovery/classification/keyword-rules";

export function DiscoveryAdvancedFilters(props: { paramString: string }) {
  const { paramString } = props;
  const router = useRouter();
  const cur = new URLSearchParams(paramString);

  const [language, setLanguage] = useState(cur.get("language") ?? "");
  const [minStars, setMinStars] = useState(cur.get("minStars") ?? "");
  const [updatedWithinDays, setUpdatedWithinDays] = useState(
    cur.get("updatedWithinDays") ?? "",
  );
  const [hasWebsite, setHasWebsite] = useState(cur.get("hasWebsite") ?? "");
  const [hasDocs, setHasDocs] = useState(cur.get("hasDocs") ?? "");
  const [hasTwitter, setHasTwitter] = useState(cur.get("hasTwitter") ?? "");
  const [hasRepo, setHasRepo] = useState(cur.get("hasRepo") ?? "");
  const [hasDescription, setHasDescription] = useState(cur.get("hasDescription") ?? "");
  const [hasTopics, setHasTopics] = useState(cur.get("hasTopics") ?? "");
  const [hasRecentCommit, setHasRecentCommit] = useState(cur.get("hasRecentCommit") ?? "");
  const [isPopular, setIsPopular] = useState(cur.get("isPopular") ?? "");
  const [isFresh, setIsFresh] = useState(cur.get("isFresh") ?? "");
  const [sourceId, setSourceId] = useState(cur.get("sourceId") ?? "");
  const [classificationStatus, setClassificationStatus] = useState(
    cur.get("classificationStatus") ?? "",
  );
  const [suggestedType, setSuggestedType] = useState(cur.get("suggestedType") ?? "");
  const [isAiRelated, setIsAiRelated] = useState(cur.get("isAiRelated") ?? "");
  const [isChineseTool, setIsChineseTool] = useState(cur.get("isChineseTool") ?? "");
  const [lowSignal, setLowSignal] = useState(cur.get("lowSignal") ?? "");

  const tri = (v: string): string | undefined => {
    if (v === "true" || v === "false") {
      return v;
    }
    return undefined;
  };

  const apply = () => {
    router.push(
      mergeAdminCandidateListUrl(cur, {
        page: "1",
        sourceId: sourceId.trim() || undefined,
        language: language.trim() || undefined,
        minStars: minStars.trim() || undefined,
        updatedWithinDays: updatedWithinDays.trim() || undefined,
        hasWebsite: tri(hasWebsite),
        hasDocs: tri(hasDocs),
        hasTwitter: tri(hasTwitter),
        hasRepo: tri(hasRepo),
        hasDescription: tri(hasDescription),
        hasTopics: tri(hasTopics),
        hasRecentCommit: tri(hasRecentCommit),
        isPopular: tri(isPopular),
        isFresh: tri(isFresh),
        classificationStatus: classificationStatus.trim() || undefined,
        suggestedType: suggestedType.trim() || undefined,
        isAiRelated: tri(isAiRelated),
        isChineseTool: tri(isChineseTool),
        lowSignal: tri(lowSignal),
      }),
    );
  };

  const clearExtras = () => {
    setLanguage("");
    setMinStars("");
    setUpdatedWithinDays("");
    setHasWebsite("");
    setHasDocs("");
    setHasTwitter("");
    setHasRepo("");
    setHasDescription("");
    setHasTopics("");
    setHasRecentCommit("");
    setIsPopular("");
    setIsFresh("");
    setSourceId("");
    setClassificationStatus("");
    setSuggestedType("");
    setIsAiRelated("");
    setIsChineseTool("");
    setLowSignal("");
    router.push(
      mergeAdminCandidateListUrl(cur, {
        page: "1",
        sourceId: undefined,
        language: undefined,
        minStars: undefined,
        updatedWithinDays: undefined,
        hasWebsite: undefined,
        hasDocs: undefined,
        hasTwitter: undefined,
        hasRepo: undefined,
        hasDescription: undefined,
        hasTopics: undefined,
        hasRecentCommit: undefined,
        isPopular: undefined,
        isFresh: undefined,
        classificationStatus: undefined,
        suggestedType: undefined,
        isAiRelated: undefined,
        isChineseTool: undefined,
        lowSignal: undefined,
      }),
    );
  };

  const selCls =
    "rounded border border-zinc-300 bg-white px-1.5 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-900";

  return (
    <details className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-3 dark:border-zinc-600 dark:bg-zinc-900/30">
      <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
        更多筛选（sourceId、语言、星级、外链布尔、新鲜度等）
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-xs">
        <div className="flex flex-wrap gap-2">
          <label className="flex items-center gap-1">
            sourceId
            <input
              className="w-40 rounded border px-1.5 py-1 font-mono dark:border-zinc-600 dark:bg-zinc-900"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              placeholder="DiscoverySource id"
            />
          </label>
          <label className="flex items-center gap-1">
            language
            <input
              className="w-24 rounded border px-1.5 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-1">
            minStars
            <input
              className="w-16 rounded border px-1.5 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={minStars}
              onChange={(e) => setMinStars(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <label className="flex items-center gap-1">
            更新≤天
            <input
              className="w-16 rounded border px-1.5 py-1 dark:border-zinc-600 dark:bg-zinc-900"
              value={updatedWithinDays}
              onChange={(e) => setUpdatedWithinDays(e.target.value)}
              inputMode="numeric"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-0.5">
            <span className="text-zinc-500">低信号清理</span>
            <select
              className={selCls}
              value={lowSignal}
              onChange={(e) => setLowSignal(e.target.value)}
              title="优先级低且无官网/仓库/摘要，便于批量 Ignore"
            >
              <option value="">—</option>
              <option value="true">仅低信号待办</option>
              <option value="false">排除</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-zinc-500">classificationStatus</span>
            <select
              className={selCls}
              value={classificationStatus}
              onChange={(e) => setClassificationStatus(e.target.value)}
            >
              <option value="">—</option>
              {DISCOVERY_CLASSIFICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-zinc-500">suggestedType</span>
            <select
              className={selCls + " min-w-[9rem]"}
              value={suggestedType}
              onChange={(e) => setSuggestedType(e.target.value)}
            >
              <option value="">—</option>
              {PRIMARY_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-0.5">
            isAiRelated
            <select className={selCls} value={isAiRelated} onChange={(e) => setIsAiRelated(e.target.value)}>
              <option value="">—</option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </label>
          <label className="flex items-center gap-0.5">
            isChineseTool
            <select className={selCls} value={isChineseTool} onChange={(e) => setIsChineseTool(e.target.value)}>
              <option value="">—</option>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["hasWebsite", hasWebsite, setHasWebsite],
              ["hasDocs", hasDocs, setHasDocs],
              ["hasTwitter", hasTwitter, setHasTwitter],
              ["hasRepo", hasRepo, setHasRepo],
              ["hasDescription", hasDescription, setHasDescription],
              ["hasTopics", hasTopics, setHasTopics],
              ["hasRecentCommit", hasRecentCommit, setHasRecentCommit],
              ["isPopular", isPopular, setIsPopular],
              ["isFresh", isFresh, setIsFresh],
            ] as const
          ).map(([label, val, setV]) => (
            <label key={label} className="flex items-center gap-0.5">
              {label}
              <select className={selCls} value={val} onChange={(e) => setV(e.target.value)}>
                <option value="">—</option>
                <option value="true">是</option>
                <option value="false">否</option>
              </select>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={apply}
            className="rounded bg-zinc-800 px-2 py-1 text-xs text-white dark:bg-zinc-200 dark:text-zinc-900"
          >
            应用筛选
          </button>
          <button type="button" onClick={clearExtras} className="rounded border border-zinc-400 px-2 py-1 text-xs dark:border-zinc-600">
            清除扩展条件
          </button>
        </div>
      </div>
    </details>
  );
}

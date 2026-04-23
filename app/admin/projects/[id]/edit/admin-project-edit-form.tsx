"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { suggestAdminProjectClassificationAndTags } from "@/lib/admin-project-classify-suggest";
import { categoryDisplayLabel } from "@/lib/tag-normalization";
import { useRedirectFromActionState } from "@/components/forms/use-redirect-from-action-state";
import type { AdminProjectEditInitial } from "@/lib/admin-project-edit";
import type { ReferenceSourceItem } from "@/lib/discovery/reference-sources";
import { ensureSinglePrimary } from "@/lib/discovery/reference-sources";
import { generateSimpleSummary } from "@/lib/project-simple-summary";
import { PROJECT_CATEGORY_OPTIONS } from "@/lib/projects/project-categories";
import { formatProjectTagsInput, parseProjectTags } from "@/lib/projects/project-tags";
import { saveAdminProject, type AdminProjectEditFormState } from "./actions";

const initialState: AdminProjectEditFormState = { ok: false, action: null };

const inputClass = "muhub-input mt-1";

type InsightView = {
  summary?: string;
  whatItIs?: string;
  whoFor?: string[];
  useCases?: string[];
  highlights?: string[];
  valueSignals?: string[];
  activity?: { level?: string; signals?: string[] };
  risks?: string[];
  suggestions?: string[];
  sourceNotes?: string[];
};

type CompletenessView = {
  score?: number;
  existing?: string[];
  missing?: string[];
  note?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function readInsightView(value: unknown): InsightView {
  const obj = asRecord(value);
  const activity = asRecord(obj.activity);
  return {
    summary: typeof obj.summary === "string" ? obj.summary : undefined,
    whatItIs: typeof obj.whatItIs === "string" ? obj.whatItIs : undefined,
    whoFor: asStringArray(obj.whoFor),
    useCases: asStringArray(obj.useCases),
    highlights: asStringArray(obj.highlights),
    valueSignals: asStringArray(obj.valueSignals),
    activity: {
      level: typeof activity.level === "string" ? activity.level : undefined,
      signals: asStringArray(activity.signals),
    },
    risks: asStringArray(obj.risks),
    suggestions: asStringArray(obj.suggestions),
    sourceNotes: asStringArray(obj.sourceNotes),
  };
}

function readCompletenessView(value: unknown): CompletenessView {
  const obj = asRecord(value);
  return {
    score: typeof obj.score === "number" ? obj.score : undefined,
    existing: asStringArray(obj.existing),
    missing: asStringArray(obj.missing),
    note: typeof obj.note === "string" ? obj.note : undefined,
  };
}

function formatPublishedAt(value: string | null | undefined) {
  if (!value) {
    return "未发布";
  }
  return value.replace("T", " ").slice(0, 19);
}

function sourceLevelLabel(level: string): string {
  if (level === "A") return "A（多源完整）";
  if (level === "B") return "B（GitHub+官网）";
  if (level === "C") return "C（仅 GitHub）";
  if (level === "D") return "D（仅项目描述）";
  if (level === "E") return "E（信息不足）";
  return level;
}

function aiOpsActionLabel(action: string): string {
  if (action === "apply_tags") return "应用标签";
  if (action === "apply_categories") return "应用分类";
  if (action === "apply_ai_summary") return "应用一句话介绍";
  if (action === "apply_ai_description") return "应用项目介绍";
  return action;
}

function readSuggestSourceFromForm(): Parameters<typeof suggestAdminProjectClassificationAndTags>[0] {
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";
  return {
    githubUrl: val("githubUrl"),
    tagline: val("tagline"),
    description: val("description"),
    name: val("name"),
    websiteUrl: val("websiteUrl"),
    aiCardSummary: val("aiCardSummary"),
  };
}

export function AdminProjectEditForm({ initial }: { initial: AdminProjectEditInitial }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveAdminProject, initialState);
  /** 与 `page.tsx` 中 `key={project.dataUpdatedAt}` 配合：保存后 remount，此处无需 effect 同步 props */
  const [categoryValue, setCategoryValue] = useState(initial.category);
  const [tagsValue, setTagsValue] = useState(initial.tags);
  const [simpleSummaryValue, setSimpleSummaryValue] = useState(initial.simpleSummary);
  const [referenceSources, setReferenceSources] = useState<ReferenceSourceItem[]>(
    initial.referenceSources ?? [],
  );
  const [classifyHint, setClassifyHint] = useState<string | null>(null);
  const [summaryGenerating, setSummaryGenerating] = useState(false);
  const [referenceMessage, setReferenceMessage] = useState<string | null>(null);
  const [aiInsightStatus, setAiInsightStatus] = useState(initial.aiInsightStatus || "idle");
  const [aiInsightError, setAiInsightError] = useState(initial.aiInsightError || "");
  const [aiInsightUpdatedAt, setAiInsightUpdatedAt] = useState(initial.aiInsightUpdatedAt || "");
  const [aiInsight, setAiInsight] = useState<unknown>(initial.aiInsight);
  const [aiCompleteness, setAiCompleteness] = useState<unknown>(initial.aiCompleteness);
  const [aiSignals, setAiSignals] = useState<unknown>(initial.aiSignals);
  const [aiSuggestedTags, setAiSuggestedTags] = useState<string[]>(
    asStringArray(initial.aiSuggestedTags),
  );
  const [aiSuggestedCategories, setAiSuggestedCategories] = useState<unknown>(
    initial.aiSuggestedCategories,
  );
  const [aiSourceSnapshot, setAiSourceSnapshot] = useState<unknown>(initial.aiSourceSnapshot);
  const [aiSourceLevel, setAiSourceLevel] = useState(initial.aiSourceLevel || "");
  const [showSourceSnapshot, setShowSourceSnapshot] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [claimReviewBusy, setClaimReviewBusy] = useState(false);
  const [claimStatus, setClaimStatus] = useState(initial.claimStatusView.claimStatus);
  const [pendingClaimId, setPendingClaimId] = useState(initial.claimStatusView.pendingClaimId);

  useRedirectFromActionState(state.redirectPath);

  useEffect(() => {
    if (state.ok && state.refreshedAt && !state.redirectPath) {
      router.refresh();
    }
  }, [router, state.ok, state.refreshedAt, state.redirectPath]);

  const statusView = {
    status: state.statusSnapshot?.status ?? initial.status,
    visibilityStatus: state.statusSnapshot?.visibilityStatus ?? initial.visibilityStatus,
    isPublic: state.statusSnapshot?.isPublic ?? initial.isPublic,
    publishedAt: state.statusSnapshot?.publishedAt ?? initial.publishedAt,
  };
  const insightView = readInsightView(aiInsight);
  const completenessView = readCompletenessView(aiCompleteness);
  const categoriesView = asRecord(aiSuggestedCategories);
  const sourceSnapshotView = asRecord(aiSourceSnapshot);
  const extractedSignals = asRecord(sourceSnapshotView.extractedSignals);
  const mainSources = asStringArray(extractedSignals.mainSources);
  const missingSources = asStringArray(extractedSignals.missingSources);

  const generateAiInsight = async () => {
    setAiBusy(true);
    setAiInsightStatus("pending");
    setAiInsightError("");
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(initial.id)}/ai-insight`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: string;
        insight?: unknown;
        completeness?: unknown;
        signals?: unknown;
        suggestedTags?: unknown;
        suggestedCategories?: unknown;
        sourceSnapshot?: unknown;
        sourceLevel?: string | null;
        updatedAt?: string | null;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "AI 认知卡生成失败，请稍后重试。");
      }
      setAiInsightStatus(json.status || "success");
      setAiInsight(json.insight);
      setAiCompleteness(json.completeness);
      setAiSignals(json.signals);
      setAiSuggestedTags(asStringArray(json.suggestedTags));
      setAiSuggestedCategories(json.suggestedCategories ?? {});
      setAiSourceSnapshot(json.sourceSnapshot ?? {});
      setAiSourceLevel(typeof json.sourceLevel === "string" ? json.sourceLevel : "");
      setAiInsightUpdatedAt(json.updatedAt || new Date().toISOString());
      setAiInsightError("");
    } catch (error) {
      setAiInsightStatus("failed");
      setAiInsightError(error instanceof Error ? error.message : "AI 认知卡生成失败，请稍后重试。");
    } finally {
      setAiBusy(false);
    }
  };

  const applyAiTags = async (mode: "append" | "replace") => {
    const defaults = aiSuggestedTags.join(", ");
    const edited = window.prompt("可编辑要应用的标签（逗号分隔）", defaults);
    if (edited === null) return;
    const selectedTags = parseProjectTags(edited).slice(0, 8);
    if (!selectedTags.length) {
      window.alert("未选择有效标签。");
      return;
    }
    if (mode === "replace" && !window.confirm("将覆盖当前标签，确定继续？")) {
      return;
    }
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(initial.id)}/apply-ai-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, tags: selectedTags }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; tags?: string[] };
    if (!res.ok || !json.ok) {
      window.alert(json.error || "应用推荐标签失败。");
      return;
    }
    const nextTags = formatProjectTagsInput(Array.isArray(json.tags) ? json.tags : selectedTags);
    setTagsValue(nextTags);
    router.refresh();
    window.alert(mode === "replace" ? "已覆盖标签。" : "已追加标签。");
  };

  const applyAiCategories = async (mode: "append" | "replace") => {
    const primaryDefault = typeof categoriesView.primary === "string" ? categoriesView.primary : "";
    const secondaryDefault = typeof categoriesView.secondary === "string" ? categoriesView.secondary : "";
    const optionalDefault = asStringArray(categoriesView.optional).join(", ");
    const primary = window.prompt("primary 分类（可编辑）", primaryDefault);
    if (primary === null) return;
    const secondary = window.prompt("secondary 分类（可编辑，可留空）", secondaryDefault);
    if (secondary === null) return;
    const optionalRaw = window.prompt("optional 分类（逗号分隔，可留空）", optionalDefault);
    if (optionalRaw === null) return;
    if (mode === "replace" && !window.confirm("将覆盖当前分类，确定继续？")) {
      return;
    }
    const optional = parseProjectTags(optionalRaw).slice(0, 8);
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(initial.id)}/apply-ai-categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        categories: {
          primary: primary.trim(),
          secondary: secondary.trim(),
          optional,
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      primaryCategory?: string | null;
    };
    if (!res.ok || !json.ok) {
      window.alert(json.error || "应用推荐分类失败。");
      return;
    }
    if (typeof json.primaryCategory === "string" && json.primaryCategory) {
      setCategoryValue(json.primaryCategory);
    }
    router.refresh();
    window.alert(mode === "replace" ? "已覆盖分类。" : "已合并分类。");
  };

  const applyAiSummary = async () => {
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(initial.id)}/apply-ai-summary`, {
      method: "POST",
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; tagline?: string };
    if (!res.ok || !json.ok || !json.tagline) {
      window.alert(json.error || "应用 AI 一句话介绍失败。");
      return;
    }
    const input = document.getElementById("tagline") as HTMLInputElement | null;
    if (input) input.value = json.tagline;
    router.refresh();
    window.alert("已应用为一句话介绍。");
  };

  const applyAiDescription = async () => {
    const res = await fetch(`/api/admin/projects/${encodeURIComponent(initial.id)}/apply-ai-description`, {
      method: "POST",
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      simpleSummary?: string;
      description?: string;
    };
    if (!res.ok || !json.ok) {
      window.alert(json.error || "应用 AI 项目介绍失败。");
      return;
    }
    const simpleSummaryEl = document.getElementById("simpleSummary") as HTMLTextAreaElement | null;
    const descEl = document.getElementById("description") as HTMLTextAreaElement | null;
    if (simpleSummaryEl && json.simpleSummary) {
      simpleSummaryEl.value = json.simpleSummary;
      setSimpleSummaryValue(json.simpleSummary);
    }
    if (descEl && json.description) {
      descEl.value = json.description;
    }
    router.refresh();
    window.alert("已应用为项目介绍。");
  };

  const reviewClaim = async (action: "approve" | "reject") => {
    if (!pendingClaimId) return;
    if (action === "reject" && !window.confirm("确认拒绝该认领申请？")) return;
    if (action === "approve" && !window.confirm("确认通过该认领申请？")) return;
    setClaimReviewBusy(true);
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(initial.id)}/claim/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        window.alert(json.error || "审核失败，请稍后重试。");
        return;
      }
      setClaimStatus(action === "approve" ? "CLAIMED" : "UNCLAIMED");
      setPendingClaimId("");
      router.refresh();
      window.alert(action === "approve" ? "已通过认领申请。" : "已拒绝认领申请。");
    } finally {
      setClaimReviewBusy(false);
    }
  };

  const applySuggestSoft = () => {
    const hadCategory = categoryValue.trim() !== "";
    const hadTags = parseProjectTags(tagsValue).length > 0;
    const result = suggestAdminProjectClassificationAndTags(readSuggestSourceFromForm());
    const suggestedTagsParsed = parseProjectTags(result.tags.join(", "));

    if (!hadCategory) {
      setCategoryValue(result.primaryCategory);
    }
    if (!hadTags) {
      setTagsValue(formatProjectTagsInput(suggestedTagsParsed.slice(0, 8)));
    }

    const parts: string[] = [];
    if (!hadCategory) {
      parts.push(`已填入分类「${result.primaryCategory}」`);
    } else {
      parts.push("分类未改动（如需替换请清空分类或点击「强制覆盖」）");
    }
    if (!hadTags) {
      parts.push(`已填入标签：${result.tags.join("，")}`);
    } else {
      parts.push("标签未改动（已手工填写；如需替换请点击「强制覆盖分类与标签」）");
    }
    setClassifyHint(parts.join("。"));
  };

  const applySuggestForce = () => {
    if (!window.confirm("将用本次规则结果覆盖当前「项目分类」和「标签」，确定？")) {
      return;
    }
    const result = suggestAdminProjectClassificationAndTags(readSuggestSourceFromForm());
    const suggestedTagsParsed = parseProjectTags(result.tags.join(", "));
    setCategoryValue(result.primaryCategory);
    setTagsValue(formatProjectTagsInput(suggestedTagsParsed.slice(0, 8)));
    setClassifyHint(`已覆盖为分类「${result.primaryCategory}」，标签：${result.tags.join("，")}`);
  };

  const generateSummary = async (force: boolean) => {
    if (!force && simpleSummaryValue.trim()) {
      if (!window.confirm("当前已填写通俗介绍，是否覆盖？")) {
        return;
      }
    }
    if (force) {
      if (!window.confirm("将覆盖当前通俗介绍，确定继续？")) {
        return;
      }
    }
    setSummaryGenerating(true);
    try {
      const val = (id: string) =>
        (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? "";
      const summary = generateSimpleSummary({
        name: val("name"),
        tagline: val("tagline"),
        description: val("description"),
        primaryCategory: categoryValue,
        tags: parseProjectTags(tagsValue),
        referenceSummaries: [
          ...referenceSources
            .filter((item) => item.isPrimary)
            .map((item) => item.summary ?? item.note ?? item.title ?? ""),
          ...referenceSources
            .filter((item) => !item.isPrimary)
            .map((item) => item.summary ?? item.note ?? item.title ?? ""),
        ].filter(Boolean),
      });
      setSimpleSummaryValue(summary);
    } finally {
      setSummaryGenerating(false);
    }
  };

  const moveUpReference = (idx: number) => {
    if (idx <= 0) {
      return;
    }
    setReferenceSources((prev) => {
      const next = [...prev];
      const tmp = next[idx - 1];
      next[idx - 1] = next[idx]!;
      next[idx] = tmp!;
      return next;
    });
    setReferenceMessage("已上移该参考资料。");
  };

  const deleteReference = (idx: number) => {
    if (!window.confirm("确认删除这条参考资料？")) {
      return;
    }
    setReferenceSources((prev) => prev.filter((_, i) => i !== idx));
    setReferenceMessage("已删除参考资料。");
  };

  const setPrimaryReference = (idx: number) => {
    setReferenceSources((prev) =>
      ensureSinglePrimary(
        prev.map((item, i) => ({
          ...item,
          isPrimary: i === idx,
        })),
      ),
    );
    setReferenceMessage("已设置为主要参考。");
  };

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="projectId" value={initial.id} />
      <input
        type="hidden"
        name="referenceSourcesJson"
        value={JSON.stringify(referenceSources)}
      />

      {state.toast ? (
        <div
          className={`rounded-xl px-4 py-3 text-sm ${
            state.toast.kind === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.toast.message}
        </div>
      ) : null}

      {state.formError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.formError}
        </div>
      ) : null}

      <section className="muhub-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">基础信息</h2>
            <p className="mt-1 text-xs text-zinc-500">
              项目 ID：
              {" "}
              <code>{initial.id}</code>
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>访问路径：/projects/{initial.slug}</div>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 sm:grid-cols-2 lg:grid-cols-4">
          <div>当前状态：{statusView.status}</div>
          <div>当前可见性：{statusView.visibilityStatus}</div>
          <div>是否公开：{statusView.isPublic ? "是" : "否"}</div>
          <div>发布时间：{formatPublishedAt(statusView.publishedAt)}</div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="name">
            项目名称
          </label>
          <input id="name" name="name" className={inputClass} defaultValue={initial.name} required />
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="tagline">
            一句话简介
          </label>
          <input id="tagline" name="tagline" className={inputClass} defaultValue={initial.tagline} />
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="simpleSummary">
              通俗介绍
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => generateSummary(false)}
                disabled={summaryGenerating}
              >
                {summaryGenerating ? "生成中..." : "自动生成"}
              </button>
              <button
                type="button"
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => generateSummary(true)}
                disabled={summaryGenerating}
              >
                覆盖生成
              </button>
            </div>
          </div>
          <textarea
            id="simpleSummary"
            name="simpleSummary"
            className={`${inputClass} min-h-[96px] resize-y`}
            value={simpleSummaryValue}
            onChange={(e) => setSimpleSummaryValue(e.target.value)}
            placeholder="用非技术语言介绍这个项目：它解决什么问题、适合谁使用。"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="category">
              项目分类
            </label>
            <select
              id="category"
              name="category"
              className={inputClass}
              value={categoryValue}
              onChange={(e) => setCategoryValue(e.target.value)}
            >
              <option value="">未分类</option>
              {PROJECT_CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="tags">
              标签
            </label>
            <input
              id="tags"
              name="tags"
              className={inputClass}
              value={tagsValue}
              onChange={(e) => setTagsValue(e.target.value)}
              placeholder="AI, 开源, Agent"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            className="muhub-btn-secondary w-fit px-3 py-2 text-sm"
            onClick={applySuggestSoft}
          >
            自动生成分类与标签
          </button>
          <button type="button" className="text-sm text-zinc-600 underline-offset-4 hover:underline" onClick={applySuggestForce}>
            强制覆盖分类与标签
          </button>
          <p className="text-xs text-zinc-500">
            根据当前表单中的 GitHub、简介、详情、名称、官网与动态摘要做规则推断；不会自动执行，也不影响发布校验中的「标签为建议项」。
          </p>
        </div>
        {classifyHint ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">{classifyHint}</p>
        ) : null}
      </section>

      <section className="muhub-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">项目认领状态</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {claimStatus === "CLAIMED" ? "已认领" : pendingClaimId ? "认领中" : "未认领"}
            </p>
          </div>
          <a
            href={`/projects/${encodeURIComponent(initial.slug)}/claim`}
            target="_blank"
            rel="noreferrer"
            className="muhub-btn-secondary px-3 py-2 text-sm"
          >
            提交认领
          </a>
        </div>
        {pendingClaimId ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>待审核申请：{initial.claimStatusView.pendingClaimUserEmail || "未知用户"}</p>
            {initial.claimStatusView.pendingClaimReason ? (
              <p className="mt-1 text-xs">申请说明：{initial.claimStatusView.pendingClaimReason}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="muhub-btn-secondary px-3 py-2 text-sm"
                disabled={claimReviewBusy}
                onClick={() => reviewClaim("approve")}
              >
                审核通过
              </button>
              <button
                type="button"
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                disabled={claimReviewBusy}
                onClick={() => reviewClaim("reject")}
              >
                审核拒绝
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="muhub-card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">官方信息（当前）</h2>
        <p className="text-xs text-zinc-500">
          官方信息由已认领用户维护，展示优先级高于 AI 整理信息。
        </p>
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 sm:grid-cols-2">
          <div>一句话介绍：{initial.officialInfo.summary || "未填写"}</div>
          <div>官网：{initial.officialInfo.website || "未填写"}</div>
          <div>Twitter：{initial.officialInfo.twitter || "未填写"}</div>
          <div>Discord：{initial.officialInfo.discord || "未填写"}</div>
          <div>联系方式：{initial.officialInfo.contactEmail || "未填写"}</div>
        </div>
        <p className="text-xs text-zinc-500">
          详细介绍：{initial.officialInfo.fullDescription || "未填写"}
        </p>
      </section>

      <section className="muhub-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI 项目认知卡</h2>
            <p className="mt-1 text-xs text-zinc-500">
              基于当前公开信息整理。仅提供判断依据与信息结构，不代表项目质量评价。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateAiInsight}
              disabled={aiBusy}
              className="muhub-btn-secondary px-3 py-2 text-sm disabled:opacity-60"
            >
              {aiBusy ? "生成中..." : aiInsightStatus === "success" ? "重新生成" : "生成 AI 认知卡"}
            </button>
            <button
              type="button"
              onClick={() => setShowSourceSnapshot((prev) => !prev)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {showSourceSnapshot ? "收起来源快照" : "查看来源快照"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
          状态：{aiInsightStatus}
          {aiInsightUpdatedAt ? ` / 最近更新：${aiInsightUpdatedAt.replace("T", " ").slice(0, 19)}` : ""}
          {aiSourceLevel ? ` / 信息来源层级：${sourceLevelLabel(aiSourceLevel)}` : ""}
        </div>

        {aiInsightStatus === "idle" ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            尚未生成 AI 项目认知卡。点击上方按钮开始生成。
          </div>
        ) : null}
        {aiInsightStatus === "pending" ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            正在整理项目信息，请稍候...
          </div>
        ) : null}
        {aiInsightStatus === "failed" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {aiInsightError || "AI 认知卡生成失败，请重试。"}
          </div>
        ) : null}

        {aiInsightStatus === "success" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">一句话理解</h3>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{insightView.summary || "信息不足"}</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{insightView.whatItIs || "信息不足"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="muhub-btn-secondary px-3 py-2 text-sm"
                  onClick={applyAiSummary}
                >
                  应用为一句话介绍
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={applyAiDescription}
                >
                  应用为项目介绍
                </button>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">适合谁 / 使用场景</h3>
                <p className="mt-2 text-xs text-zinc-500">适合谁</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(insightView.whoFor ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
                <p className="mt-3 text-xs text-zinc-500">使用场景</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(insightView.useCases ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">亮点 / 判断依据</h3>
                <p className="mt-2 text-xs text-zinc-500">亮点</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(insightView.highlights ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
                <p className="mt-3 text-xs text-zinc-500">判断依据</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(insightView.valueSignals ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">活跃度与依据</h3>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  活跃度：{insightView.activity?.level || "unknown"}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(insightView.activity?.signals ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">信息完整度</h3>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  分数：{typeof completenessView.score === "number" ? completenessView.score : "-"} / 100
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {completenessView.note || "该分数仅反映当前公开信息完整度，不代表项目质量评价。"}
                </p>
                <p className="mt-2 text-xs text-zinc-500">已有信息</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(completenessView.existing ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
                <p className="mt-2 text-xs text-zinc-500">当前缺少的信息</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(completenessView.missing ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">风险与建议</h3>
                <p className="mt-2 text-xs text-zinc-500">风险</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(insightView.risks ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
                <p className="mt-3 text-xs text-zinc-500">建议</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {(insightView.suggestions ?? []).map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI 推荐标签/分类</h3>
                <p className="mt-2 text-xs text-zinc-500">当前标签</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {parseProjectTags(tagsValue).map((tag) => (
                    <span
                      key={`cur-${tag}`}
                      className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">推荐标签</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {aiSuggestedTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-xs text-zinc-500">推荐分类</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  <li>primary: {categoryDisplayLabel(typeof categoriesView.primary === "string" ? categoriesView.primary : null)}</li>
                  <li>secondary: {categoryDisplayLabel(typeof categoriesView.secondary === "string" ? categoriesView.secondary : null)}</li>
                  <li>optional: {asStringArray(categoriesView.optional).map((item) => categoryDisplayLabel(item)).join("、") || "-"}</li>
                </ul>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">来源与备注</h3>
              <p className="mt-2 text-xs text-zinc-500">
                主要信息来源：{mainSources.join(" / ") || "信息不足"}
              </p>
              {missingSources.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-300">
                  {missingSources.map((item) => <li key={item}>⚠️ {item}</li>)}
                </ul>
              ) : null}
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                {(insightView.sourceNotes ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            {showSourceSnapshot ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">来源快照（可复核）</h3>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-700 dark:text-zinc-300">
                  {JSON.stringify({ sourceSnapshot: aiSourceSnapshot, signals: aiSignals }, null, 2)}
                </pre>
              </div>
            ) : null}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">应用推荐到正式数据</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="muhub-btn-secondary px-3 py-2 text-sm"
                  onClick={() => applyAiTags("append")}
                >
                  应用推荐标签
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => applyAiTags("replace")}
                >
                  覆盖标签
                </button>
                <button
                  type="button"
                  className="muhub-btn-secondary px-3 py-2 text-sm"
                  onClick={() => applyAiCategories("append")}
                >
                  应用推荐分类
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  onClick={() => applyAiCategories("replace")}
                >
                  覆盖分类
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                默认采用追加模式，不会自动覆盖已有数据；覆盖模式会再次确认。
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">最近操作记录</h3>
              {initial.aiOpsLogs.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">暂无 AI 应用操作记录。</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {initial.aiOpsLogs.map((log) => (
                    <li key={log.id} className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                      {log.createdAt.replace("T", " ").slice(0, 19)}
                      {" / "}
                      {aiOpsActionLabel(log.action)}
                      {" / "}
                      {log.mode === "replace" ? "覆盖模式" : "追加模式"}
                      {" / "}
                      操作人：{log.operatorEmail || "未知"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className="muhub-card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">外部链接</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="websiteUrl">
              官网链接
            </label>
            <input id="websiteUrl" name="websiteUrl" className={inputClass} defaultValue={initial.websiteUrl} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="githubUrl">
              GitHub 链接
            </label>
            <input id="githubUrl" name="githubUrl" className={inputClass} defaultValue={initial.githubUrl} />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="externalLinksText">
            其它外部链接
          </label>
          <textarea
            id="externalLinksText"
            name="externalLinksText"
            className={`${inputClass} min-h-[120px] resize-y`}
            defaultValue={initial.externalLinksText}
            placeholder="每行一条，格式：平台, URL, 标签(可选), primary(可选)"
          />
          <p className="mt-1 text-xs text-zinc-500">例如：docs, https://example.com/docs, 文档, primary</p>
        </div>
      </section>

      <section className="muhub-card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">项目详情</h2>
        <textarea
          id="description"
          name="description"
          className={`${inputClass} min-h-[180px] resize-y`}
          defaultValue={initial.description}
        />
      </section>

      <section className="muhub-card space-y-3 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">参考资料</h2>
        {referenceMessage ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
            {referenceMessage}
          </p>
        ) : null}
        {referenceSources.length === 0 ? (
          <p className="text-sm text-zinc-500">暂无参考资料（通常由 Discovery 候选继承）。</p>
        ) : (
          <ul className="space-y-2">
            {referenceSources.map((item, idx) => (
              <li key={`${item.type}-${item.url}-${idx}`} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/40">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-zinc-500">{item.type}</p>
                  {item.isPrimary ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                      主要参考
                    </span>
                  ) : null}
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-blue-600 underline dark:text-blue-400">
                  {item.title || item.url}
                </a>
                {(item.summary || item.note) ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{item.summary || item.note}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => deleteReference(idx)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-300">
                    删除
                  </button>
                  <button type="button" onClick={() => setPrimaryReference(idx)} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
                    设为主要参考
                  </button>
                  <button type="button" onClick={() => moveUpReference(idx)} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-600 dark:text-zinc-300" disabled={idx === 0}>
                    上移
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="muhub-card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">动态摘要</h2>
        <textarea
          id="aiCardSummary"
          name="aiCardSummary"
          className={`${inputClass} min-h-[120px] resize-y`}
          defaultValue={initial.aiCardSummary}
          placeholder="可填写首页卡片或详情页摘要，营销能力后续进入营销中心处理。"
        />
      </section>

      <section className="muhub-card space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">发布检查</h2>
            <p className="mt-1 text-xs text-zinc-500">
              来源：{initial.discoverySource || "手动创建"} / {initial.discoverySourceId || "—"}
              {initial.importedFromCandidateId ? ` / 待筛选项目 ${initial.importedFromCandidateId}` : ""}
            </p>
          </div>
          <Link
            href={`/admin/marketing?projectId=${encodeURIComponent(initial.id)}`}
            className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900 underline-offset-2 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950/70"
          >
            进入项目营销中心
          </Link>
        </div>

        {initial.readinessMessages.length > 0 ? (
          <ul className="list-inside list-disc rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {initial.readinessMessages.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            当前资料已经满足基础发布检查，可以直接发布。
          </div>
        )}

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          发布阻塞项：
          {" "}
          项目名称、项目分类、一句话简介或项目详情至少一项、官网/GitHub/外部链接至少一项。
          {" "}
          其它提示仅为建议项，不会阻塞发布。
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className="muhub-btn-secondary px-4 py-3 disabled:opacity-60"
        >
          {pending && state.action === "save" ? "保存中..." : "保存草稿"}
        </button>
        <Link href={`/projects/${initial.slug}`} target="_blank" className="muhub-btn-secondary px-4 py-3">
          预览
        </Link>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className="muhub-btn-primary px-4 py-3 disabled:opacity-60"
        >
          {pending && state.action === "publish" ? "发布中..." : "发布项目"}
        </button>
      </div>
    </form>
  );
}

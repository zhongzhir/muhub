"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { suggestAdminProjectClassificationAndTags } from "@/lib/admin-project-classify-suggest";
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

function formatPublishedAt(value: string | null | undefined) {
  if (!value) {
    return "未发布";
  }
  return value.replace("T", " ").slice(0, 19);
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

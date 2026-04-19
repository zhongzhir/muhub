"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { suggestAdminProjectClassificationAndTags } from "@/lib/admin-project-classify-suggest";
import { useRedirectFromActionState } from "@/components/forms/use-redirect-from-action-state";
import type { AdminProjectEditInitial } from "@/lib/admin-project-edit";
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
  const [categoryValue, setCategoryValue] = useState(initial.category);
  const [tagsValue, setTagsValue] = useState(initial.tags);
  const [classifyHint, setClassifyHint] = useState<string | null>(null);

  useRedirectFromActionState(state.redirectPath);

  useEffect(() => {
    setCategoryValue(initial.category);
    setTagsValue(initial.tags);
    setClassifyHint(null);
  }, [initial.id, initial.dataUpdatedAt, initial.category, initial.tags]);

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

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="projectId" value={initial.id} />

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
          <button
            type="button"
            disabled
            className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-400"
          >
            进入项目营销中心（预留）
          </button>
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

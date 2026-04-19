"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRedirectFromActionState } from "@/components/forms/use-redirect-from-action-state";
import type { AdminProjectEditInitial } from "@/lib/admin-project-edit";
import { PROJECT_CATEGORY_OPTIONS } from "@/lib/projects/project-categories";
import { saveAdminProject, type AdminProjectEditFormState } from "./actions";

const initialState: AdminProjectEditFormState = { ok: false };

const inputClass = "muhub-input mt-1";

export function AdminProjectEditForm({ initial }: { initial: AdminProjectEditInitial }) {
  const [state, formAction, pending] = useActionState(saveAdminProject, initialState);
  useRedirectFromActionState(state.redirectPath);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="projectId" value={initial.id} />

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
              项目 ID：<code>{initial.id}</code>
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>状态：{initial.status}</div>
            <div>访问路径：/projects/{initial.slug}</div>
          </div>
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
            <select id="category" name="category" className={inputClass} defaultValue={initial.category}>
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
              defaultValue={initial.tags}
              placeholder="AI, 开源, Agent"
            />
          </div>
        </div>
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
            placeholder={"每行一条，格式：平台, URL, 标签(可选), primary(可选)"}
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

        <div className="grid gap-3 text-xs text-zinc-500 sm:grid-cols-3">
          <div>当前状态：{initial.status}</div>
          <div>可见性：{initial.visibilityStatus}</div>
          <div>发布时间：{initial.publishedAt ? initial.publishedAt.replace("T", " ").slice(0, 19) : "未发布"}</div>
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
          {pending ? "保存中..." : "保存草稿"}
        </button>
        <Link
          href={`/projects/${initial.slug}`}
          target="_blank"
          className="muhub-btn-secondary px-4 py-3"
        >
          预览
        </Link>
        <button
          type="submit"
          name="intent"
          value="publish"
          disabled={pending}
          className="muhub-btn-primary px-4 py-3 disabled:opacity-60"
        >
          发布项目
        </button>
      </div>
    </form>
  );
}

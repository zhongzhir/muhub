"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRedirectFromActionState } from "@/components/forms/use-redirect-from-action-state";
import { projectPublicPathPrefix } from "@/lib/seo/site";
import type { ProjectEditInitial } from "@/lib/project-edit";
import { PROJECT_CATEGORY_OPTIONS } from "@/lib/projects/project-categories";
import { updateProject, type UpdateProjectFormState } from "./actions";

const inputClass = "muhub-input mt-1";

const sectionTitle = "muhub-form-legend";

const initialState: UpdateProjectFormState = { ok: false };

function aiStatusBadgeClass(status: string): string {
  if (status === "done") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  }
  if (status === "failed") {
    return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  }
  if (status === "scheduled") {
    return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }
  return "bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400";
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export function EditProjectForm({ initial }: { initial: ProjectEditInitial }) {
  const [state, formAction, pending] = useActionState(updateProject, initialState);
  const pathPrefix = projectPublicPathPrefix();

  useRedirectFromActionState(state.redirectPath);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="slug" value={initial.slug} />

      {state.formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          <p className="whitespace-pre-line">{state.formError}</p>
        </div>
      ) : null}

      <fieldset className="muhub-card space-y-4 p-5 sm:p-6">
        <legend className={sectionTitle}>基础信息</legend>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="name">
          项目名称 <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          className={inputClass}
          name="name"
          type="text"
          required
          autoComplete="off"
          defaultValue={initial.name}
        />
        <FieldError message={state.fieldErrors?.name} />

        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">项目访问地址</span>
        <p id="edit-slug-hint" className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          这是你在木哈布上的项目页面地址，不是 GitHub 仓库地址。创建后不可修改。
        </p>
        <div className="mt-1 flex min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-300/90 bg-white shadow-sm dark:border-zinc-600 dark:bg-zinc-900 sm:flex-row">
          <span
            className="inline-flex items-center border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[11px] leading-snug text-zinc-600 [overflow-wrap:anywhere] break-all border-b sm:border-b-0 sm:border-r dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400"
            aria-hidden
          >
            {pathPrefix}
          </span>
          <p
            className="min-w-0 flex-1 [overflow-wrap:anywhere] break-all bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            aria-readonly="true"
            aria-describedby="edit-slug-hint"
          >
            {initial.slug}
          </p>
        </div>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="tagline">
          一句话介绍
        </label>
        <input
          id="tagline"
          className={inputClass}
          name="tagline"
          type="text"
          autoComplete="off"
          defaultValue={initial.tagline}
        />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="category">
          项目分类
        </label>
        <select id="category" className={inputClass} name="category" defaultValue={initial.category}>
          <option value="">未分类</option>
          {PROJECT_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors?.category} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="description">
          项目介绍
        </label>
        <textarea
          id="description"
          className={`${inputClass} min-h-[120px] resize-y`}
          name="description"
          rows={5}
          defaultValue={initial.description}
        />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="tags">
          标签
        </label>
        <input
          id="tags"
          className={inputClass}
          name="tags"
          type="text"
          autoComplete="off"
          defaultValue={initial.tags}
          placeholder="例如：ai, open-source, llm（逗号分隔）"
        />
      </fieldset>

      <fieldset className="muhub-card space-y-4 p-5 sm:p-6">
        <legend className={sectionTitle}>项目链接</legend>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="githubUrl">
          GitHub 仓库链接
        </label>
        <input
          id="githubUrl"
          className={inputClass}
          name="githubUrl"
          type="url"
          autoComplete="off"
          defaultValue={initial.githubUrl}
        />
        <FieldError message={state.fieldErrors?.githubUrl} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="websiteUrl">
          官网链接
        </label>
        <input
          id="websiteUrl"
          className={inputClass}
          name="websiteUrl"
          type="url"
          autoComplete="off"
          defaultValue={initial.websiteUrl}
        />
        <FieldError message={state.fieldErrors?.websiteUrl} />
      </fieldset>

      <fieldset className="muhub-card space-y-4 p-5 sm:p-6">
        <legend className={sectionTitle}>社媒信息</legend>
        <p className="text-xs text-zinc-500">
          可填写账号名或完整链接；留空并保存将移除对应平台记录。
        </p>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="weibo">
          微博
        </label>
        <input id="weibo" className={inputClass} name="weibo" type="text" defaultValue={initial.weibo} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="wechat_official">
          微信公众号
        </label>
        <input
          id="wechat_official"
          className={inputClass}
          name="wechat_official"
          type="text"
          defaultValue={initial.wechat_official}
        />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="douyin">
          抖音
        </label>
        <input id="douyin" className={inputClass} name="douyin" type="text" defaultValue={initial.douyin} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="xiaohongshu">
          小红书
        </label>
        <input
          id="xiaohongshu"
          className={inputClass}
          name="xiaohongshu"
          type="text"
          defaultValue={initial.xiaohongshu}
        />
      </fieldset>

      <fieldset className="muhub-card space-y-4 p-5 sm:p-6">
        <legend className={sectionTitle}>运营状态</legend>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          是否在广场对外公开请在下方「发布设置」中操作（公开 / 隐藏），此处仅影响项目生命周期标签。
        </p>
        <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
          <span className="mr-2 text-zinc-500 dark:text-zinc-400">AI Status</span>
          <span className={`rounded px-2 py-0.5 ${aiStatusBadgeClass(initial.aiStatus)}`}>
            {initial.aiStatus || "-"}
          </span>
          {initial.aiUpdatedAt ? (
            <span className="ml-2 font-mono text-zinc-500 dark:text-zinc-400">
              {initial.aiUpdatedAt.replace("T", " ").slice(0, 19)}
            </span>
          ) : null}
          {initial.aiStatus === "failed" && initial.aiError ? (
            <p className="mt-1 text-red-600 dark:text-red-400">{initial.aiError}</p>
          ) : null}
        </div>

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="status">
          项目状态
        </label>
        <select
          id="status"
          name="status"
          className={inputClass}
          defaultValue={initial.status}
          aria-invalid={Boolean(state.fieldErrors?.status)}
        >
          <option value="DRAFT">草稿</option>
          <option value="ACTIVE">已发布</option>
          <option value="ARCHIVED">已归档</option>
        </select>
        <FieldError message={state.fieldErrors?.status} />

        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            name="isFeatured"
            type="checkbox"
            defaultChecked={initial.isFeatured}
            className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500 dark:border-zinc-600 dark:bg-zinc-900"
          />
          设为精选项目（Featured）
        </label>
      </fieldset>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" disabled={pending} className="muhub-btn-primary px-4 py-3 disabled:opacity-60">
          {pending ? "保存中…" : "保存修改"}
        </button>
        <Link href={`/projects/${initial.slug}`} className="muhub-btn-secondary px-4 py-3">
          返回项目页
        </Link>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { projectPublicPathPrefix } from "@/lib/seo/site";
import type { NewProjectPrefill } from "./prefill";
import { createProject, type CreateProjectFormState } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400";

const sectionTitle = "text-sm font-semibold text-zinc-800 dark:text-zinc-200";

const initialState: CreateProjectFormState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

const emptyPrefill: NewProjectPrefill = {
  name: "",
  tagline: "",
  slug: "",
  githubUrl: "",
  websiteUrl: "",
  creationSource: "manual",
};

export function NewProjectForm({ prefill }: { prefill?: NewProjectPrefill }) {
  const p = prefill ?? emptyPrefill;
  const [state, formAction, pending] = useActionState(createProject, initialState);
  const pathPrefix = projectPublicPathPrefix();
  const exampleSlug = "muhub";

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="creationSource" value={p.creationSource || "manual"} />
      {state.formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          <p className="whitespace-pre-line">{state.formError}</p>
        </div>
      ) : null}

      <fieldset className="space-y-4">
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
          placeholder="例如：木哈布"
          defaultValue={p.name || undefined}
        />
        <FieldError message={state.fieldErrors?.name} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="project-slug-input">
          项目访问地址 <span className="text-red-500">*</span>
        </label>
        <p id="slug-hint" className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          这是你在木哈布上的项目页面地址，不是 GitHub 仓库地址。例如：{pathPrefix}
          {exampleSlug}
        </p>
        <div className="mt-1 flex min-w-0 flex-col overflow-hidden rounded-lg border border-zinc-300 bg-white shadow-sm focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus-within:border-zinc-400 dark:focus-within:ring-zinc-400 sm:flex-row">
          <span
            className="inline-flex shrink-0 items-center border-zinc-200 bg-zinc-50 px-2.5 py-2 text-[11px] leading-snug text-zinc-600 [overflow-wrap:anywhere] break-all border-b sm:border-b-0 sm:border-r dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400"
            aria-hidden
          >
            {pathPrefix}
          </span>
          <input
            id="project-slug-input"
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm outline-none dark:text-zinc-100"
            name="slug"
            type="text"
            required
            autoComplete="off"
            placeholder="仅小写字母、数字、短横线，如 muhub"
            defaultValue={p.slug || undefined}
            aria-describedby="slug-hint"
          />
        </div>
        <FieldError message={state.fieldErrors?.slug} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="tagline">
          一句话介绍
        </label>
        <input
          id="tagline"
          className={inputClass}
          name="tagline"
          type="text"
          autoComplete="off"
          placeholder="简短标语"
          defaultValue={p.tagline || undefined}
        />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="description">
          项目介绍
        </label>
        <textarea
          id="description"
          className={`${inputClass} min-h-[120px] resize-y`}
          name="description"
          rows={5}
          placeholder="支持多行描述"
        />
      </fieldset>

      <fieldset className="space-y-4">
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
          placeholder="https://github.com/org/repo"
          defaultValue={p.githubUrl || undefined}
        />
        <FieldError message={state.fieldErrors?.githubUrl} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="giteeUrl">
          Gitee 仓库链接（可选，第二仓库）
        </label>
        <input
          id="giteeUrl"
          className={inputClass}
          name="giteeUrl"
          type="url"
          autoComplete="off"
          placeholder="https://gitee.com/org/repo"
        />
        <FieldError message={state.fieldErrors?.giteeUrl} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="websiteUrl">
          官网链接
        </label>
        <input
          id="websiteUrl"
          className={inputClass}
          name="websiteUrl"
          type="url"
          autoComplete="off"
          placeholder="https://..."
          defaultValue={p.websiteUrl || undefined}
        />
        <FieldError message={state.fieldErrors?.websiteUrl} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="docsUrl">
          文档站链接（可选）
        </label>
        <input
          id="docsUrl"
          className={inputClass}
          name="docsUrl"
          type="url"
          autoComplete="off"
          placeholder="https://docs.example.com"
        />
        <FieldError message={state.fieldErrors?.docsUrl} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="blogUrl">
          博客链接（可选）
        </label>
        <input
          id="blogUrl"
          className={inputClass}
          name="blogUrl"
          type="url"
          autoComplete="off"
          placeholder="https://blog.example.com"
        />
        <FieldError message={state.fieldErrors?.blogUrl} />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="twitterUrl">
          海外社媒主页（X / Twitter）链接（可选）
        </label>
        <input
          id="twitterUrl"
          className={inputClass}
          name="twitterUrl"
          type="url"
          autoComplete="off"
          placeholder="https://x.com/…"
        />
        <FieldError message={state.fieldErrors?.twitterUrl} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className={sectionTitle}>社媒信息</legend>
        <p className="text-xs text-zinc-500">
          可填写账号名或完整链接；以 http(s) 开头的输入会保存为链接。
        </p>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="weibo">
          微博
        </label>
        <input id="weibo" className={inputClass} name="weibo" type="text" autoComplete="off" />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="wechat_official">
          微信公众号
        </label>
        <input
          id="wechat_official"
          className={inputClass}
          name="wechat_official"
          type="text"
          autoComplete="off"
        />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="douyin">
          抖音
        </label>
        <input id="douyin" className={inputClass} name="douyin" type="text" autoComplete="off" />

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="xiaohongshu">
          小红书
        </label>
        <input id="xiaohongshu" className={inputClass} name="xiaohongshu" type="text" autoComplete="off" />
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto"
      >
        {pending ? "提交中…" : "创建项目"}
      </button>
    </form>
  );
}

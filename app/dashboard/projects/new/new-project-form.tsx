"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRedirectFromActionState } from "@/components/forms/use-redirect-from-action-state";
import type { NewProjectPrefill } from "./prefill";
import { createProject, type CreateProjectFormState } from "./actions";
import { prefillProjectFromImportUrl } from "./import-prefill-actions";

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
  description: "",
  githubUrl: "",
  giteeUrl: "",
  websiteUrl: "",
  creationSource: "manual",
};

function buildPrefillQuery(fields: NewProjectPrefill): string {
  const q = new URLSearchParams();
  if (fields.name) {
    q.set("name", fields.name);
  }
  if (fields.tagline) {
    q.set("tagline", fields.tagline);
  }
  if (fields.description) {
    q.set("description", fields.description);
  }
  if (fields.slug) {
    q.set("slug", fields.slug);
  }
  if (fields.githubUrl) {
    q.set("githubUrl", fields.githubUrl);
  }
  if (fields.giteeUrl) {
    q.set("giteeUrl", fields.giteeUrl);
  }
  if (fields.websiteUrl) {
    q.set("websiteUrl", fields.websiteUrl);
  }
  if (fields.creationSource) {
    q.set("creationSource", fields.creationSource);
  }
  return q.toString();
}

export function NewProjectForm({ prefill }: { prefill?: NewProjectPrefill }) {
  const p = prefill ?? emptyPrefill;
  const [state, formAction, pending] = useActionState(createProject, initialState);
  const router = useRouter();
  const [importUrl, setImportUrl] = useState("");
  const [importHint, setImportHint] = useState<string | null>(null);
  const [importPending, startImportTransition] = useTransition();

  useRedirectFromActionState(state.redirectPath);

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
          placeholder="例如：木哈布 或 MUHUB"
          defaultValue={p.name || undefined}
        />
        <FieldError message={state.fieldErrors?.name} />
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          保存后系统会根据<strong className="font-medium text-zinc-600 dark:text-zinc-300">项目名称</strong>
          自动生成页面地址（支持中文）；若与其它项目命名冲突，会自动加上「-2」「-3」等后缀。
        </p>

        <fieldset className="space-y-3 rounded-lg border border-zinc-200/90 bg-zinc-50/50 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/35">
          <legend className={sectionTitle}>导入</legend>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            输入 GitHub / Gitee / 官网等链接，系统会尽量预填项目信息。目前优先支持{" "}
            <strong className="font-medium text-zinc-600 dark:text-zinc-300">代码仓库</strong>{" "}
            链接，其他来源将逐步支持。
          </p>
          <label className="sr-only" htmlFor="import-source-url">
            导入来源链接
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <input
              id="import-source-url"
              className={inputClass}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://github.com/owner/repo 或 Gitee 仓库地址"
              value={importUrl}
              disabled={importPending}
              onChange={(e) => {
                setImportUrl(e.target.value);
                setImportHint(null);
              }}
            />
            <button
              type="button"
              disabled={importPending}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:w-auto sm:self-start"
              onClick={() => {
                setImportHint(null);
                startImportTransition(async () => {
                  const res = await prefillProjectFromImportUrl(importUrl);
                  if (!res.ok) {
                    setImportHint(res.message);
                    return;
                  }
                  const qs = buildPrefillQuery({
                    name: res.fields.name,
                    tagline: res.fields.tagline,
                    description: res.fields.description,
                    slug: "",
                    githubUrl: res.fields.githubUrl,
                    giteeUrl: res.fields.giteeUrl,
                    websiteUrl: res.fields.websiteUrl,
                    creationSource: res.fields.creationSource,
                  });
                  router.replace(`/dashboard/projects/new?${qs}`);
                });
              }}
            >
              {importPending ? "解析中…" : "解析并预填"}
            </button>
          </div>
          {importHint ? (
            <p role="status" className="text-xs text-amber-800 dark:text-amber-200/90">
              {importHint}
            </p>
          ) : null}
        </fieldset>

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
          placeholder="支持多行描述（可选）"
          defaultValue={p.description || undefined}
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
          defaultValue={p.giteeUrl || undefined}
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

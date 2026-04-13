"use client";

import type { ProjectSourceKind } from "@prisma/client";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useRedirectFromActionState } from "@/components/forms/use-redirect-from-action-state";
import type { NewProjectPrefill } from "./prefill";
import { createProject, type CreateProjectFormState } from "./actions";
import { prefillProjectFromImportUrl } from "./import-prefill-actions";
import { detectSourceUrlKind } from "@/lib/project-detect-source";
import { PROJECT_CATEGORY_OPTIONS } from "@/lib/projects/project-categories";

const inputClass = "muhub-input mt-1";

const sectionTitle = "muhub-form-legend";

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

const EXTRA_SOURCE_OPTIONS: { value: ProjectSourceKind; label: string }[] = [
  { value: "GITHUB", label: "GitHub" },
  { value: "GITEE", label: "Gitee" },
  { value: "WEBSITE", label: "官网" },
  { value: "WECHAT", label: "公众号" },
  { value: "XIAOHONGSHU", label: "小红书" },
  { value: "DOUYIN", label: "抖音" },
  { value: "ZHIHU", label: "知乎" },
  { value: "BILIBILI", label: "B站" },
  { value: "TWITTER", label: "X / Twitter" },
  { value: "DISCORD", label: "Discord" },
  { value: "DOCS", label: "文档" },
  { value: "BLOG", label: "博客" },
  { value: "OTHER", label: "其它" },
];

function makeExtraRowKey(): string {
  return `es-${Math.random().toString(36).slice(2, 11)}`;
}

type ExtraSourceRowState = { key: string; kind: ProjectSourceKind; url: string };

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
  const [extraRows, setExtraRows] = useState<ExtraSourceRowState[]>(() =>
    (p.extraSources ?? []).map((s) => ({
      key: makeExtraRowKey(),
      kind: s.kind,
      url: s.url,
    })),
  );

  const extraSourcesJson = useMemo(() => {
    const rows: { kind: ProjectSourceKind; url: string }[] = [];
    for (const r of extraRows) {
      const t = r.url.trim();
      if (!t) {
        continue;
      }
      let href: string;
      try {
        href = new URL(t).href;
      } catch {
        try {
          href = new URL(`https://${t}`).href;
        } catch {
          continue;
        }
      }
      rows.push({ kind: r.kind, url: href });
    }
    return JSON.stringify(rows);
  }, [extraRows]);

  useRedirectFromActionState(state.redirectPath);

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="creationSource" value={p.creationSource || "manual"} />
      <input type="hidden" name="extraSourcesJson" value={extraSourcesJson} />
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
          placeholder="例如：木哈布 或 MUHUB"
          defaultValue={p.name || undefined}
        />
        <FieldError message={state.fieldErrors?.name} />
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          保存后系统会根据<strong className="font-medium text-zinc-600 dark:text-zinc-300">项目名称</strong>
          自动生成页面地址（支持中文）；若与其它项目命名冲突，会自动加上「-2」「-3」等后缀。
        </p>

        <fieldset className="muhub-card space-y-3 p-4 sm:p-5">
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
              className="muhub-btn-outline shrink-0 px-4 py-2 sm:w-auto sm:self-start"
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

        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="category">
          项目分类
        </label>
        <select id="category" className={inputClass} name="category" defaultValue="">
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
          placeholder="支持多行描述（可选）"
          defaultValue={p.description || undefined}
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
          placeholder="例如：ai, open-source, llm（逗号分隔）"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          使用逗号分隔；保存时会自动规范化、去重并限制数量。
        </p>

        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            name="isFeatured"
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500 dark:border-zinc-600 dark:bg-zinc-900"
          />
          设为精选项目（Featured）
        </label>
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

      <fieldset className="muhub-card space-y-4 p-5 sm:p-6">
        <legend className={sectionTitle}>项目来源（可多条）</legend>
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          除上方主仓库与官网外，可补充公众号、小红书、文档等链接；提交时写入「信息源」。在输入框失焦时会按链接自动修正类型。
        </p>
        <div className="space-y-3">
          {extraRows.map((row) => (
            <div
              key={row.key}
              className="muhub-card flex flex-col gap-2 p-3 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <label
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  htmlFor={`extra-kind-${row.key}`}
                >
                  来源类型
                </label>
                <select
                  id={`extra-kind-${row.key}`}
                  className={`${inputClass} cursor-pointer`}
                  value={row.kind}
                  onChange={(e) => {
                    const kind = e.target.value as ProjectSourceKind;
                    setExtraRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, kind } : r)),
                    );
                  }}
                >
                  {EXTRA_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-0 flex-[2]">
                <label
                  className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                  htmlFor={`extra-url-${row.key}`}
                >
                  链接
                </label>
                <input
                  id={`extra-url-${row.key}`}
                  className={inputClass}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://…"
                  value={row.url}
                  onChange={(e) =>
                    setExtraRows((prev) =>
                      prev.map((r) => (r.key === row.key ? { ...r, url: e.target.value } : r)),
                    )
                  }
                  onBlur={() => {
                    const t = row.url.trim();
                    if (!t) {
                      return;
                    }
                    let href: string;
                    try {
                      href = new URL(t).href;
                    } catch {
                      try {
                        href = new URL(`https://${t}`).href;
                      } catch {
                        return;
                      }
                    }
                    const inferred = detectSourceUrlKind(href);
                    setExtraRows((prev) =>
                      prev.map((r) =>
                        r.key === row.key ? { ...r, url: href, kind: inferred } : r,
                      ),
                    );
                  }}
                />
              </div>
              <button type="button" className="muhub-btn-outline shrink-0 px-3 py-2 sm:mb-0"
                onClick={() =>
                  setExtraRows((prev) => prev.filter((r) => r.key !== row.key))
                }
              >
                删除
              </button>
            </div>
          ))}
          <button type="button" className="muhub-btn-outline inline-flex items-center px-3 py-2"
            onClick={() =>
              setExtraRows((prev) => [
                ...prev,
                { key: makeExtraRowKey(), kind: "WEBSITE", url: "" },
              ])
            }
          >
            添加来源
          </button>
        </div>
      </fieldset>

      <fieldset className="muhub-card space-y-4 p-5 sm:p-6">
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
        className="muhub-btn-primary inline-flex w-full px-4 py-3 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "提交中…" : "创建项目"}
      </button>
    </form>
  );
}

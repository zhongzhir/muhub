"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ProjectSourceRegistryItem } from "@/agents/sources/types";
import {
  submitImportExternalProject,
  type ImportExternalProjectState,
} from "@/app/dashboard/import-project/actions";

const inputClass = "muhub-input mt-1";

const initialState: ImportExternalProjectState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export function ImportExternalProjectForm({
  sources,
}: {
  sources: ProjectSourceRegistryItem[];
}) {
  const [state, formAction, pending] = useActionState(submitImportExternalProject, initialState);

  if (state.ok && state.mode === "created" && state.slug) {
    return (
      <div className="space-y-6">
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100"
        >
          <p className="font-medium">项目已创建</p>
          <p className="mt-2 text-emerald-800/90 dark:text-emerald-200/90">
            已写入 MUHUB 数据库，并进入与「从 GitHub 导入」一致的 sourceType 流程（import）。
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href={`/projects/${state.slug}`} className="muhub-btn-primary px-4 py-2">
              查看公开页
            </Link>
            <Link href={`/dashboard/projects/${state.slug}`} className="muhub-btn-secondary px-4 py-2">
              进入管理页
            </Link>
            <Link
              href="/dashboard/import-project"
              className="inline-flex items-center justify-center text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
            >
              继续导入
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (state.ok && state.mode === "pending") {
    return (
      <div
        role="status"
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      >
        <p className="font-medium">已保存为待导入记录</p>
        <p className="mt-2 text-amber-900/90 dark:text-amber-100/90">
          本轮未创建 MUHUB
          项目；记录已追加到本地文件 <code className="rounded bg-white/60 px-1 text-xs dark:bg-black/30">data/pending-external-imports.json</code>
          ，后续可接批处理或审核入库。
        </p>
        <p className="mt-3">
          <Link href="/dashboard/import-project" className="font-medium underline-offset-2 hover:underline">
            返回表单
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {state.formError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
        >
          <p className="whitespace-pre-line">{state.formError}</p>
        </div>
      ) : null}

      <fieldset className="muhub-card space-y-4 p-5 sm:p-6">
        <legend className="muhub-form-legend">项目信息</legend>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="imp-name">
            项目名称 <span className="text-red-500">*</span>
          </label>
          <input id="imp-name" name="name" type="text" required className={inputClass} autoComplete="off" />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="imp-url">
            项目官网或仓库链接 <span className="text-red-500">*</span>
          </label>
          <input
            id="imp-url"
            name="url"
            type="url"
            required
            className={inputClass}
            placeholder="https:// 或省略协议由系统补全"
          />
          <FieldError message={state.fieldErrors?.url} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="imp-desc">
            项目简介
          </label>
          <textarea id="imp-desc" name="description" rows={4} className={inputClass} />
          <FieldError message={state.fieldErrors?.description} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="imp-source">
            来源 <span className="text-red-500">*</span>
          </label>
          <select id="imp-source" name="sourceId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              请选择来源
            </option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <FieldError message={state.fieldErrors?.sourceId} />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            选项来自来源注册表（V1.1 静态）；与增长编排器 discovery 映射一致。
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="imp-tags">
            标签
          </label>
          <input
            id="imp-tags"
            name="tags"
            type="text"
            className={inputClass}
            placeholder="例如：AI, 开源, 工具（逗号分隔）"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="imp-notes">
            备注
          </label>
          <textarea id="imp-notes" name="notes" rows={2} className={inputClass} />
        </div>
      </fieldset>

      <fieldset className="muhub-card space-y-3 p-5 sm:p-6">
        <legend className="muhub-form-legend">导入方式</legend>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="deferOnly"
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600"
          />
          <span>
            仅保存为待导入记录（写入本地 JSON，<strong className="font-medium">不立即</strong>创建项目）
          </span>
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          默认不勾选：提交后将调用与「创建项目」相同的写库逻辑，并附带增长来源与备注。
        </p>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="muhub-btn-primary inline-flex w-full px-5 py-2.5 disabled:opacity-60 sm:w-auto"
      >
        {pending ? "提交中…" : "提交导入"}
      </button>

      <section
        aria-labelledby="future-import-heading"
        className="rounded-xl border border-dashed border-zinc-300/90 bg-zinc-50/80 px-4 py-5 dark:border-zinc-600 dark:bg-zinc-900/40"
      >
        <h2 id="future-import-heading" className="muhub-form-legend normal-case tracking-normal text-zinc-800 dark:text-zinc-200">
          更多导入方式（即将推出）
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          后续将支持通过海报、展会照片、活动名单等识别项目信息并辅助创建。代码侧已预留{" "}
          <code className="rounded bg-white px-1 text-xs dark:bg-zinc-800">rawInputType</code>（如{" "}
          <code className="rounded bg-white px-1 text-xs dark:bg-zinc-800">image-poster</code>、
          <code className="rounded bg-white px-1 text-xs dark:bg-zinc-800">event-photo</code>
          ）供 OCR 管线接入。
        </p>
        <button
          type="button"
          disabled
          className="mt-4 inline-flex cursor-not-allowed items-center rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
          aria-disabled="true"
        >
          从海报 / 照片导入（未开放）
        </button>
      </section>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProject } from "../actions";

export function DeleteProjectButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section
      className="mt-12 rounded-xl border border-red-200/90 bg-red-50/40 px-5 py-5 dark:border-red-900/50 dark:bg-red-950/25"
      aria-labelledby="delete-project-heading"
    >
      <h2
        id="delete-project-heading"
        className="text-sm font-semibold text-red-900 dark:text-red-200"
      >
        危险操作
      </h2>
      <p className="mt-2 text-xs leading-relaxed text-red-800/90 dark:text-red-200/85">
        删除为软删除：数据仍保留在库中，后续可通过恢复接口或运营处理找回。
      </p>
      {error ? (
        <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        className="mt-4 inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-800 shadow-sm transition hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-900/30"
        onClick={() => {
          if (
            !window.confirm(
              "确定删除这个项目？\n\n删除后项目将不会在广场和公开页显示，但数据会先保留，后续可恢复。",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const r = await deleteProject(slug);
            if (!r.ok) {
              setError(r.error ?? "删除失败，请稍后重试。");
              return;
            }
            router.push("/dashboard");
            router.refresh();
          });
        }}
      >
        {pending ? "删除中…" : "删除项目"}
      </button>
    </section>
  );
}

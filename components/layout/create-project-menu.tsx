"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const triggerClass =
  "inline-flex items-center rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 sm:px-2.5 sm:text-sm dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100";

const itemClass =
  "block w-full px-3 py-2.5 text-left text-sm text-zinc-800 transition hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/80";

export type CreateProjectMenuProps = {
  /** 未登录时跳转登录后再进入对应流程 */
  authenticated: boolean;
};

export function CreateProjectMenu({ authenticated }: CreateProjectMenuProps) {
  const manualHref = authenticated
    ? "/dashboard/projects/new"
    : "/auth/signin?callbackUrl=/dashboard/projects/new";
  const githubImportHref = authenticated
    ? "/dashboard/projects/import"
    : "/auth/signin?callbackUrl=/dashboard/projects/import";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        创建项目
        <span className="ml-0.5 text-zinc-400" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <Link href={manualHref} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            手动创建
          </Link>
          <Link href={githubImportHref} role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            从 GitHub 导入
          </Link>
        </div>
      ) : null}
    </div>
  );
}

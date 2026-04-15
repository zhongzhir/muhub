"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const triggerClass = "muhub-nav-link muhub-nav-link--strong inline-flex items-center gap-0.5";

const itemClass = "muhub-menu-item";

export type CreateProjectMenuProps = {
  /** 未登录时跳转登录后再进入对应流程 */
  authenticated: boolean;
};

export function CreateProjectMenu({ authenticated }: CreateProjectMenuProps) {
  const manualHref = authenticated
    ? "/dashboard/projects/new"
    : "/login?redirect=/dashboard/projects/new";
  const githubImportHref = authenticated
    ? "/dashboard/projects/import"
    : "/login?redirect=/dashboard/projects/import";
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
        <div role="menu" className="muhub-menu-panel absolute right-0 z-50 mt-1 min-w-[11rem]">
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

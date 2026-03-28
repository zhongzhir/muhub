"use client";

import Image from "next/image";
import { signOut } from "next-auth/react";

export function UserMenu({
  name,
  email,
  image,
  phone,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  phone?: string | null;
}) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  const phoneLabel = digits.length >= 4 ? `用户${digits.slice(-4)}` : null;
  const label = name?.trim() || phoneLabel || email?.trim() || "账户";
  const initial = label.slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden max-w-[10rem] truncate text-xs text-zinc-600 sm:inline dark:text-zinc-400" title={label}>
        {label}
      </span>
      {image ? (
        <Image
          src={image}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
        />
      ) : (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          aria-hidden
        >
          {initial}
        </span>
      )}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 sm:px-2.5 sm:text-sm dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
      >
        退出
      </button>
    </div>
  );
}

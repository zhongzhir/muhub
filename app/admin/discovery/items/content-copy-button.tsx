"use client";

import { useState } from "react";

const btnClass =
  "rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

type ContentCopyButtonProps = {
  text: string;
};

export function ContentCopyButton({ text }: ContentCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      className={btnClass}
      disabled={pending}
      onClick={() => {
        setPending(true);
        void navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .finally(() => {
            setPending(false);
          });
      }}
    >
      {copied ? "Copied!" : pending ? "Copying..." : "Copy"}
    </button>
  );
}

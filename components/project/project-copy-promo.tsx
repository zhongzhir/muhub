"use client";

import { useState } from "react";

type Props = {
  text: string;
};

export default function ProjectCopyPromo({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button onClick={handleCopy} className="rounded-md border px-3 py-1 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200">
      {copied ? "Copied!" : "Copy Promo"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { ProjectShareDialog } from "@/components/project/project-share-dialog";

type Props = {
  name: string;
  tagline: string | undefined;
  shareSnippet: string;
  canonicalUrl: string;
  shareClipboardText: string;
};

const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

export function ProjectPublicShareBar(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6" data-testid="project-public-share-bar">
      <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
        分享项目
      </button>
      <ProjectShareDialog open={open} onOpenChange={setOpen} {...props} />
    </div>
  );
}

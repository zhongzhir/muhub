"use client";

import { useState } from "react";

export type ProjectProConnectProps = {
  projectName: string;
  projectSlug: string;
  contactEmail?: string | null;
  websiteUrl?: string | null;
  useCases?: string[];
  whoFor?: string[];
  claimStatus: "CLAIMED" | "UNCLAIMED";
};

export function ProjectProConnect({
  projectName: _projectName,
  projectSlug,
  contactEmail,
  websiteUrl,
  useCases,
  whoFor,
  claimStatus: _claimStatus,
}: ProjectProConnectProps) {
  const [copied, setCopied] = useState(false);

  const hasWhoFor = Array.isArray(whoFor) && whoFor.length > 0;
  const hasUseCases = Array.isArray(useCases) && useCases.length > 0;
  const hasInfoBlock = hasWhoFor || hasUseCases;

  const handleShareCard = () => {
    // Navigate to share page
    window.location.href = `/projects/${projectSlug}/share`;
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900/40">
      {/* Section title with teal left border accent */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-0.5 self-stretch bg-teal-500 rounded-full" />
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          与项目方联接
        </h3>
      </div>

      {/* CTA Button area */}
      <div className="flex flex-wrap gap-3">
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            → 访问官网 / 试用
          </a>
        ) : null}

        {contactEmail ? (
          <a
            href={`mailto:${contactEmail}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-100 dark:border-teal-700/60 dark:bg-teal-950/30 dark:text-teal-300 dark:hover:bg-teal-950/50"
          >
            发邮件联系
          </a>
        ) : null}

        <button
          type="button"
          onClick={handleShareCard}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-transparent px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
        >
          分享名片
        </button>
      </div>

      {/* Info summary block */}
      {hasInfoBlock ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {hasWhoFor ? (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                目标用户
              </p>
              <div className="flex flex-wrap gap-1.5">
                {whoFor!.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {hasUseCases ? (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                适用场景
              </p>
              <div className="flex flex-wrap gap-1.5">
                {useCases!.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Disclaimer */}
      <p className="mt-5 text-[11px] text-zinc-400 dark:text-zinc-500">
        MUHUB 提供信息展示与联系通道，不对项目合作结果作担保。
      </p>
    </div>
  );
}

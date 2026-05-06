"use client";

import { useState } from "react";

type ContentPayload = {
  copy?: {
    oneLiner?: string;
    short?: string;
    medium?: string;
    long?: string;
    audienceVersions?: {
      general?: string;
      business?: string;
      creator?: string;
      developer?: string;
    };
  };
  poster?: {
    title?: string;
    subtitle?: string;
    highlights?: string[];
    targetUsers?: string;
    callToAction?: string;
    contactLine?: string;
  };
};

export type ProjectSpreadContentProps = {
  projectId: string;
  content: ContentPayload | Record<string, unknown> | null;
  draft: ContentPayload | Record<string, unknown> | null;
  status: string; // "idle" | "pending" | "success" | "failed"
};

type TabKey = "oneLiner" | "short" | "medium" | "long" | "audience";

const TAB_LIST: { key: TabKey; label: string }[] = [
  { key: "oneLiner", label: "一句话" },
  { key: "short", label: "简介 100字" },
  { key: "medium", label: "简介 300字" },
  { key: "long", label: "简介 800字" },
  { key: "audience", label: "受众版本" },
];

function statusBadge(status: string) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        已就绪
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        生成中
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      待生成
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.alert("复制失败，请手动复制。");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
      title={`复制${label}`}
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

function AudienceBlock({
  label,
  text,
}: {
  label: string;
  text: string | undefined;
}) {
  const value = text?.trim() || "";
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {label}
        </span>
        {value ? <CopyButton text={value} label={label} /> : null}
      </div>
      <p className="mt-1.5 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
        {value || <span className="text-zinc-400 dark:text-zinc-600">暂无内容</span>}
      </p>
    </div>
  );
}

export function ProjectSpreadContent({
  projectId,
  content,
  draft,
  status: initialStatus,
}: ProjectSpreadContentProps) {
  const [status, setStatus] = useState(initialStatus || "idle");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("oneLiner");
  const liveContent = content as ContentPayload | null;
  const [liveDraft, setLiveDraft] = useState<ContentPayload | null>(draft as ContentPayload | null);

  // Active content: draft takes priority over content
  const active: ContentPayload =
    (liveDraft && Object.keys(liveDraft).length > 0 ? liveDraft : liveContent) ?? {};

  const isEmpty =
    !active.copy?.oneLiner &&
    !active.copy?.short &&
    !active.copy?.medium &&
    !active.copy?.long;

  const generate = async () => {
    setBusy(true);
    setStatus("pending");
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-content`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: string;
        content?: unknown;
        updatedAt?: string | null;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "生成失败，请稍后重试。");
      }
      const nextContent =
        json.content && typeof json.content === "object"
          ? (json.content as ContentPayload)
          : {};
      setLiveDraft(nextContent);
      setStatus(json.status || "success");
    } catch (e) {
      setStatus("failed");
      window.alert(e instanceof Error ? e.message : "生成失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  const showGuide = status === "idle" || isEmpty;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900/40">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">传播资产</h3>
          {statusBadge(status)}
        </div>
        {status !== "pending" ? (
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-60 dark:border-teal-700/60 dark:bg-teal-950/30 dark:text-teal-300 dark:hover:bg-teal-950/50"
          >
            {busy ? "生成中..." : status === "success" ? "重新生成" : "生成传播内容"}
          </button>
        ) : null}
      </div>

      {/* Guide / empty state */}
      {showGuide ? (
        <div className="mt-5 rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-5 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          {status === "pending" ? (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              正在生成传播资产，请稍候...
            </p>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              传播资产正在准备中。点击&ldquo;生成传播内容&rdquo;按钮，AI 将根据项目信息自动生成一句话定位、多长度介绍和多受众版本文案。
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="mt-5 flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-700">
            {TAB_LIST.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "px-3 py-1.5 text-sm transition",
                  activeTab === tab.key
                    ? "border-b-2 border-teal-500 font-medium text-teal-700 dark:text-teal-400"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="mt-4">
            {activeTab === "oneLiner" ? (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">适合标题 / 社交平台简介</p>
                  {active.copy?.oneLiner ? (
                    <CopyButton text={active.copy.oneLiner} label="一句话" />
                  ) : null}
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {active.copy?.oneLiner || (
                    <span className="text-zinc-400 dark:text-zinc-600">暂无内容</span>
                  )}
                </p>
              </div>
            ) : null}

            {activeTab === "short" ? (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">适合卡片 / 简短介绍</p>
                  {active.copy?.short ? (
                    <CopyButton text={active.copy.short} label="简介 100字" />
                  ) : null}
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {active.copy?.short || (
                    <span className="text-zinc-400 dark:text-zinc-600">暂无内容</span>
                  )}
                </p>
              </div>
            ) : null}

            {activeTab === "medium" ? (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">适合项目介绍页 / 合作沟通</p>
                  {active.copy?.medium ? (
                    <CopyButton text={active.copy.medium} label="简介 300字" />
                  ) : null}
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {active.copy?.medium || (
                    <span className="text-zinc-400 dark:text-zinc-600">暂无内容</span>
                  )}
                </p>
              </div>
            ) : null}

            {activeTab === "long" ? (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">适合公众号 / 长内容</p>
                  {active.copy?.long ? (
                    <CopyButton text={active.copy.long} label="简介 800字" />
                  ) : null}
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
                  {active.copy?.long || (
                    <span className="text-zinc-400 dark:text-zinc-600">暂无内容</span>
                  )}
                </p>
              </div>
            ) : null}

            {activeTab === "audience" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <AudienceBlock label="普通用户 (general)" text={active.copy?.audienceVersions?.general} />
                <AudienceBlock label="合作招商 (business)" text={active.copy?.audienceVersions?.business} />
                <AudienceBlock label="内容创作者 (creator)" text={active.copy?.audienceVersions?.creator} />
                <AudienceBlock label="技术用户 (developer)" text={active.copy?.audienceVersions?.developer} />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

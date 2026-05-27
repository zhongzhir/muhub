"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createDiscoverySourceAction,
  updateDiscoverySourceAction,
} from "./actions";

const STATUSES = ["TESTING", "ACTIVE", "PAUSED", "DISABLED"] as const;
const KINDS = ["RSS", "GITHUB_TOPIC", "WEBSITE", "WEBSITE_SCAN", "WECHAT", "OTHER"] as const;
const OWNERS = ["system", "manual", "expert"] as const;

export function DiscoverySourceForm(props: {
  mode: "create" | "edit";
  sourceId?: string;
  initial?: {
    name?: string;
    url?: string;
    sourceKind?: string;
    status?: string;
    sourceOwner?: string;
    notes?: string | null;
    topics?: string;
    allowedDomains?: string;
    maxDepth?: string;
    maxPages?: string;
    includeKeywords?: string;
    excludePatterns?: string;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState(props.initial?.sourceKind ?? "RSS");
  const isWebsiteScan = sourceKind === "WEBSITE_SCAN";

  return (
    <form
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMsg(null);
        start(async () => {
          const r =
            props.mode === "create"
              ? await createDiscoverySourceAction(fd)
              : await updateDiscoverySourceAction(props.sourceId!, fd);
          if (!r.ok) {
            setMsg(r.error);
            return;
          }
          setMsg("已保存");
          router.refresh();
          if (props.mode === "create" && r.id) {
            router.push(`/admin/discovery/sources/${r.id}`);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">名称 *</span>
          <input
            name="name"
            required
            defaultValue={props.initial?.name ?? ""}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            {isWebsiteScan ? "起始 URL *" : "URL *"}
          </span>
          <input
            name="url"
            required
            defaultValue={props.initial?.url ?? ""}
            placeholder={isWebsiteScan ? "http://example.com/" : undefined}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">来源类型</span>
          <select
            name="sourceKind"
            value={sourceKind}
            onChange={(e) => setSourceKind(e.target.value)}
            disabled={props.mode === "edit"}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">状态</span>
          <select
            name="status"
            defaultValue={props.initial?.status ?? "TESTING"}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">维护者</span>
          <select
            name="sourceOwner"
            defaultValue={props.initial?.sourceOwner ?? "manual"}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          >
            {OWNERS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        {!isWebsiteScan ? (
          <label className="block text-sm sm:col-span-2">
            <span className="text-zinc-600 dark:text-zinc-400">GitHub Topics（逗号分隔，仅 GITHUB_TOPIC）</span>
            <input
              name="topics"
              defaultValue={props.initial?.topics ?? ""}
              placeholder="publishing, ai-writing"
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
          </label>
        ) : null}
        {isWebsiteScan ? (
          <>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-600 dark:text-zinc-400">allowedDomains（逗号分隔）</span>
              <input
                name="allowedDomains"
                defaultValue={
                  props.initial?.allowedDomains ??
                  "dpresearch.bjzzcb.com, mp.weixin.qq.com"
                }
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">maxDepth</span>
              <input
                name="maxDepth"
                type="number"
                min={0}
                max={5}
                defaultValue={props.initial?.maxDepth ?? "2"}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">maxPages</span>
              <input
                name="maxPages"
                type="number"
                min={1}
                max={200}
                defaultValue={props.initial?.maxPages ?? "50"}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-600 dark:text-zinc-400">includeKeywords（逗号分隔）</span>
              <input
                name="includeKeywords"
                defaultValue={
                  props.initial?.includeKeywords ??
                  "AI, 人工智能, 大模型, 数字出版, 智能出版, 出版科技, AIGC"
                }
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-zinc-600 dark:text-zinc-400">excludePatterns（逗号分隔）</span>
              <input
                name="excludePatterns"
                defaultValue={props.initial?.excludePatterns ?? "login, search, comment"}
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              />
            </label>
          </>
        ) : null}
        <label className="block text-sm sm:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-400">备注 notes</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={props.initial?.notes ?? ""}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
      </div>
      {isWebsiteScan ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          WEBSITE_SCAN：受控 BFS 扫描，产出 Signal（非 Candidate）。maxPages/maxDepth 必填且保守设置。
        </p>
      ) : (
        <p className="text-xs text-zinc-500">scope 默认 publishing_ai；新建来源建议先 TESTING，验证产出后再 ACTIVE。</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {props.mode === "create" ? "创建来源" : "保存修改"}
      </button>
      {msg ? <p className="text-xs text-zinc-500">{msg}</p> : null}
    </form>
  );
}

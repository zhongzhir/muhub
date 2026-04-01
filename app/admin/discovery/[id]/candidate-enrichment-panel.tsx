"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

export type EnrichmentLinkRow = {
  id: string;
  platform: string;
  url: string;
  normalizedUrl: string;
  host: string | null;
  source: string;
  confidence: number;
  isPrimary: boolean;
  isAccepted: boolean;
  evidenceText: string | null;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EnrichmentJobSummary = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  extractedCount: number;
  errorMessage: string | null;
};

type CurrentLinks = {
  website: string | null;
  docsUrl: string | null;
  twitterUrl: string | null;
  youtubeUrl: string | null;
};

export function CandidateEnrichmentPanel(props: {
  candidateId: string;
  enrichmentStatus: string;
  current: CurrentLinks;
  links: EnrichmentLinkRow[];
  lastJob: EnrichmentJobSummary | null;
}) {
  const { candidateId, enrichmentStatus, current, links: initialLinks, lastJob } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [links, setLinks] = useState<EnrichmentLinkRow[]>(initialLinks);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLinks(initialLinks);
  }, [initialLinks]);

  const refreshLinks = useCallback(async () => {
    const res = await fetch(
      `/api/admin/discovery/candidates/${candidateId}/enrichment-links`,
      { credentials: "include" },
    );
    const json = (await res.json()) as { ok?: boolean; links?: EnrichmentLinkRow[] };
    if (res.ok && json.ok && Array.isArray(json.links)) {
      setLinks(json.links);
    }
  }, [candidateId]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const runEnrichment = () => {
    setMessage(null);
    start(async () => {
      const res = await fetch(
        `/api/admin/discovery/candidates/${candidateId}/enrich`,
        { method: "POST", credentials: "include" },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        extractedCount?: number;
        jobId?: string;
      };
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setMessage(
        `已完成：任务 ${json.jobId ?? "—"}，合并链接数 ${json.extractedCount ?? "—"}`,
      );
      await refreshLinks();
      router.refresh();
    });
  };

  const acceptSelected = () => {
    if (selected.size === 0) {
      setMessage("请先勾选要接受的链接");
      return;
    }
    setMessage(null);
    start(async () => {
      const res = await fetch(
        `/api/admin/discovery/candidates/${candidateId}/accept-enrichment`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkIds: Array.from(selected) }),
        },
      );
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        writtenFields?: string[];
        skipped?: { linkId: string; reason: string }[];
      };
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? `HTTP ${res.status}`);
        return;
      }
      const w = json.writtenFields?.length ? json.writtenFields.join(", ") : "无（字段已有值或未映射）";
      setMessage(`已标记接受；写回字段：${w}`);
      setSelected(new Set());
      await refreshLinks();
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Enrichment（外链补全 V1）
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            状态：{enrichmentStatus} · 从 GitHub README / 仓库主页 / owner、以及官网首页抽取；不覆盖已有字段，需勾选后
            Accept 写回。
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={runEnrichment}
          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          运行 Enrichment
        </button>
      </div>

      {lastJob ? (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          最近任务：{lastJob.status} · {lastJob.extractedCount} 条（合并后计数）·{" "}
          {lastJob.finishedAt ? new Date(lastJob.finishedAt).toLocaleString() : "进行中"}
          {lastJob.errorMessage ? (
            <span className="ml-1 text-red-600 dark:text-red-400">· {lastJob.errorMessage}</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">尚未运行过 enrichment 任务。</p>
      )}

      {message ? (
        <p className="mt-2 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800/60">
          {message}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            候选当前已填链接
          </h3>
          <ul className="mt-1 space-y-0.5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>官网：{current.website ?? "—"}</li>
            <li>文档：{current.docsUrl ?? "—"}</li>
            <li>X/Twitter：{current.twitterUrl ?? "—"}</li>
            <li>YouTube：{current.youtubeUrl ?? "—"}</li>
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending || selected.size === 0}
            onClick={acceptSelected}
            className="rounded border border-emerald-600 px-2 py-1 text-xs font-medium text-emerald-800 disabled:opacity-50 dark:border-emerald-500 dark:text-emerald-300"
          >
            接受选中并写回（仅空字段）
          </button>
          <span className="text-xs text-zinc-500">已选 {selected.size} 条</span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              <tr>
                <th className="px-2 py-2 w-8"></th>
                <th className="px-2 py-2">平台</th>
                <th className="px-2 py-2">来源</th>
                <th className="px-2 py-2">置信度</th>
                <th className="px-2 py-2">已接受</th>
                <th className="px-2 py-2">URL</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-zinc-100 dark:border-zinc-800/80"
                >
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(l.id)}
                      onChange={() => toggle(l.id)}
                      disabled={l.isAccepted}
                      aria-label={`选择 ${l.platform}`}
                    />
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{l.platform}</td>
                  <td className="px-2 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {l.source}
                  </td>
                  <td className="px-2 py-2 tabular-nums text-xs">{l.confidence.toFixed(2)}</td>
                  <td className="px-2 py-2 text-xs">{l.isAccepted ? "是" : "—"}</td>
                  <td className="max-w-[280px] px-2 py-2 break-all text-xs">
                    <a
                      href={l.url}
                      className="text-blue-600 underline dark:text-blue-400"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {l.url}
                    </a>
                    {l.evidenceText ? (
                      <div className="mt-0.5 text-[10px] text-zinc-500 line-clamp-2" title={l.evidenceText}>
                        {l.evidenceText}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {links.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-zinc-500">
              暂无抽取结果，请点击「运行 Enrichment」。
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

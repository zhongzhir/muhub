import type { ContentOutputItem } from "@/lib/admin/content-output-reader";

import { ContentCopyButton } from "./content-copy-button";
import { ContentOutputsRefreshButton } from "./content-outputs-refresh-button";

type ContentOutputsPanelProps = {
  wechatDraft: ContentOutputItem | null;
  xDrafts: ContentOutputItem[];
};

function formatUpdatedAt(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function ContentOutputsPanel({ wechatDraft, xDrafts }: ContentOutputsPanelProps) {
  const latestXGeneratedAt = xDrafts[0]?.updatedAt ?? null;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Content Outputs</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            WeChat: {wechatDraft ? 1 : 0} · X: {xDrafts.length}
          </p>
        </div>
        <ContentOutputsRefreshButton />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">WeChat Draft</h3>
            {wechatDraft ? <ContentCopyButton text={wechatDraft.content} /> : null}
          </div>
          {wechatDraft ? (
            <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              Last generated: {formatUpdatedAt(wechatDraft.updatedAt)}
            </p>
          ) : null}
          {wechatDraft ? (
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                {wechatDraft.filename} · {formatUpdatedAt(wechatDraft.updatedAt)}
              </p>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/30 dark:text-zinc-200">
                {wechatDraft.content}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No WeChat draft yet. Run Content Pipeline to generate one.
            </p>
          )}
        </div>

        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-semibold text-zinc-800 dark:text-zinc-100">X Drafts</h3>
          {latestXGeneratedAt ? (
            <p className="mb-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              Last generated: {formatUpdatedAt(latestXGeneratedAt)}
            </p>
          ) : null}
          {xDrafts.length === 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No X drafts yet. Run Content Pipeline to generate drafts.
            </p>
          ) : (
            <div className="space-y-3">
              {xDrafts.map((draft) => (
                <article key={draft.filename} className="rounded border border-zinc-200 p-2.5 dark:border-zinc-700">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {draft.filename} · {formatUpdatedAt(draft.updatedAt)}
                    </p>
                    <ContentCopyButton text={draft.content} />
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-200">
                    {draft.content}
                  </pre>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        <p>Source: muhub-ops-engine/outputs/wechat</p>
        <p>Source: muhub-ops-engine/outputs/x</p>
      </div>
    </section>
  );
}

import {
  FEEDBACK_TAG_LABELS,
  type EntityHintFeedbackTag,
} from "@/lib/discovery/entity/feedback-types";
import { listEntityHintFeedback } from "@/lib/discovery/entity/feedback-crud";

const ACTION_BADGE: Record<string, string> = {
  ACCEPT: "text-emerald-700 dark:text-emerald-300",
  REJECT: "text-rose-700 dark:text-rose-300",
  UNSURE: "text-amber-700 dark:text-amber-300",
};

export async function EntityHintFeedbackHistory({ hintId }: { hintId: string }) {
  const rows = await listEntityHintFeedback(hintId, 15);

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">反馈历史</h2>
        <p className="mt-2 text-sm text-zinc-500">暂无反馈记录。</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h2 className="text-sm font-semibold">反馈历史</h2>
      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-lg border border-zinc-100 p-3 text-sm dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`font-medium ${ACTION_BADGE[row.action] ?? ""}`}>
                {row.action}
              </span>
              <span className="text-xs text-zinc-500">{row.reviewer}</span>
              <span className="text-xs text-zinc-400">
                {row.createdAt.toLocaleString("zh-CN")}
              </span>
              {row.isHighValue ? (
                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                  高价值
                </span>
              ) : null}
              {row.shouldTrackLongTerm ? (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                  长期跟踪
                </span>
              ) : null}
            </div>
            {row.feedbackTags.length ? (
              <p className="mt-1.5 flex flex-wrap gap-1">
                {row.feedbackTags.map((tag: EntityHintFeedbackTag) => (
                  <span
                    key={tag}
                    className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {FEEDBACK_TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </p>
            ) : null}
            {row.feedbackReason ? (
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">{row.feedbackReason}</p>
            ) : null}
            {row.notes ? (
              <p className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                {row.notes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

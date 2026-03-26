import type { GithubSnapshotView } from "@/lib/demo-project";
import type { ShareProgressModel } from "@/lib/share-project-view";
import { getUpdateStreamPrimaryLabel } from "@/lib/project-updates";
import { computeGithubActivity } from "@/lib/github-activity";

type Props = {
  model: ShareProgressModel;
  /** snapshot 仅在 model 为 placeholder 时用于展示活跃度一行补充 */
  githubSnapshot?: GithubSnapshotView | null;
};

export function ShareProgressSection({ model, githubSnapshot }: Props) {
  return (
    <section
      className="px-6 py-6"
      aria-labelledby="share-progress-heading"
      data-testid="share-project-progress"
    >
      <h2
        id="share-progress-heading"
        className="text-xs font-semibold uppercase tracking-widest text-emerald-800 dark:text-emerald-300"
      >
        当前进展
      </h2>
      <div className="mt-4 rounded-2xl border border-emerald-100/90 bg-gradient-to-b from-emerald-50/50 to-white px-4 py-4 dark:border-emerald-900/35 dark:from-emerald-950/20 dark:to-zinc-900/30">
        {model.mode === "weekly" ? (
          <>
            {model.windowHint ? (
              <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                周总结 · {model.windowHint}
              </p>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">{model.summary}</p>
          </>
        ) : null}
        {model.mode === "updates" ? (
          <>
            {model.updates.length === 0 ? (
              <p className="text-sm text-zinc-500">暂无近期动态</p>
            ) : (
              <ul className="space-y-3">
                {model.updates.map((u, i) => {
                  const t = u.createdAt ?? u.occurredAt;
                  const sum = u.summary?.trim();
                  return (
                    <li
                      key={u.id ?? `${u.title}-${t.toISOString()}-${i}`}
                      data-testid="share-recent-update-item"
                      className="rounded-lg border border-emerald-100/70 bg-white/80 px-3 py-2.5 dark:border-emerald-900/25 dark:bg-zinc-900/50"
                    >
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{u.title}</p>
                      {sum ? (
                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {sum}
                        </p>
                      ) : null}
                      <p
                        className="mt-1 text-xs text-zinc-500"
                        data-testid="share-recent-update-source"
                      >
                        {getUpdateStreamPrimaryLabel({
                          sourceType: u.sourceType,
                          sourceLabel: u.sourceLabel,
                          isAiGenerated: u.isAiGenerated,
                        })}
                      </p>
                      <time className="mt-0.5 block text-[11px] text-zinc-400" dateTime={t.toISOString()}>
                        {t.toLocaleString("zh-CN")}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
        {model.mode === "snapshot" ? (
          <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            {model.lines.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {model.mode === "placeholder" ? (
          <>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{model.message}</p>
            {githubSnapshot ? (
              <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                活跃度：{computeGithubActivity(githubSnapshot).label}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

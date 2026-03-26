import type { ShareHighlightSource } from "@/lib/share-project-view";

type Props = {
  paragraphs: string[];
  source: ShareHighlightSource;
  tags?: string[];
};

const SOURCE_NOTE: Record<ShareHighlightSource, string | null> = {
  ai_card: "摘要由 AI 基于公开信息生成",
  description: "来自项目介绍",
  tagline: "由一句话介绍延展",
  placeholder: null,
};

export function ShareHighlightSection({ paragraphs, source, tags }: Props) {
  const note = SOURCE_NOTE[source];

  return (
    <section
      className="px-6 py-6"
      aria-labelledby="share-highlights-heading"
      data-testid="share-project-highlights"
    >
      <h2
        id="share-highlights-heading"
        className="text-xs font-semibold uppercase tracking-widest text-violet-700 dark:text-violet-300"
      >
        项目亮点
      </h2>
      {note ? (
        <p className="mt-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{note}</p>
      ) : null}
      <div className="mt-4 space-y-3">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="rounded-xl border border-violet-100/90 bg-gradient-to-br from-violet-50/80 to-white px-4 py-3 text-sm leading-relaxed text-zinc-800 shadow-sm dark:border-violet-900/30 dark:from-violet-950/25 dark:to-zinc-900/40 dark:text-zinc-200"
            data-testid={i === 0 ? "share-highlight-lead" : undefined}
          >
            {p}
          </p>
        ))}
      </div>
      {tags && tags.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2" data-testid="share-project-tags">
          {tags.map((t) => (
            <li
              key={t}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {t}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

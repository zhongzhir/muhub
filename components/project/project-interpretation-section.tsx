import type { ProjectInterpretationResult } from "@/lib/project-interpretation";

function toneRing(tone: "neutral" | "positive" | "cautious" | undefined): string {
  switch (tone) {
    case "positive":
      return "border-emerald-200/90 bg-emerald-50/50 dark:border-emerald-900/45 dark:bg-emerald-950/25";
    case "cautious":
      return "border-amber-200/90 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/25";
    default:
      return "border-zinc-200/90 bg-zinc-50/60 dark:border-zinc-700 dark:bg-zinc-900/40";
  }
}

type Props = {
  interpretation: ProjectInterpretationResult;
};

/** 项目公开页：规则解读模块（V1）；无条目时不渲染以免占版面 */
export function ProjectInterpretationSection({ interpretation }: Props) {
  if (!interpretation.items.length) {
    return null;
  }

  return (
    <section
      className="mt-8 rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white px-6 py-5 shadow-sm dark:border-sky-900/40 dark:from-sky-950/25 dark:to-zinc-900 md:px-8"
      aria-labelledby="project-interpretation-heading"
      data-testid="project-interpretation"
    >
      <h2
        id="project-interpretation-heading"
        className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-200"
      >
        项目解读
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-sky-900/70 dark:text-sky-200/75">
        把开发者侧的公开数据说明成更好懂的表述（当前为规则版，非 AI 分析报告）。
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {interpretation.items.map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border px-4 py-3 ${toneRing(item.tone)}`}
          >
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.label}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{item.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

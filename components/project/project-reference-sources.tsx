import { normalizeReferenceSources } from "@/lib/discovery/reference-sources";

type ReferenceSource = {
  title?: string;
  url: string;
  summary?: string;
  sourceName?: string;
  source?: string | null;
  type?: string;
};

function iconByType(type?: string): string {
  const value = (type ?? "").toUpperCase();
  if (value === "NEWS") return "📰";
  if (value === "SOCIAL") return "💬";
  if (value === "BLOG") return "✍️";
  return "";
}

export function ProjectReferenceSources({ sources }: { sources?: ReferenceSource[] }) {
  const rows = normalizeReferenceSources(sources)
    .slice(0, 5)
    .map((item) => ({
      title: item.title?.trim() || item.url,
      url: item.url,
      sourceName: item.sourceName ?? item.source ?? null,
      type: item.type,
      isPrimary: Boolean(item.isPrimary),
    }))
    .filter((item) => Boolean(item.url.trim()));

  if (rows.length === 0) {
    return null;
  }

  return (
    <section className="muhub-page-section mt-10">
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        📚 参考资料 / 媒体报道
      </h2>
      <ul className="mt-4 space-y-3">
        {rows.map((item, idx) => {
          const icon = iconByType(item.type);
          return (
            <li
              key={`${item.url}-${idx}`}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40"
            >
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
              >
                {icon ? `${icon} ` : ""}
                {item.title}
              </a>
              {item.isPrimary ? (
                <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  主要参考
                </p>
              ) : null}
              {item.sourceName ? (
                <p className="mt-1 text-xs text-zinc-500">来源：{item.sourceName}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

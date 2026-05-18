import type { ReactNode } from "react";

export function HelpCallout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      {children}
    </div>
  );
}

export function HelpTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[280px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top text-zinc-700 dark:text-zinc-300">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HelpProse({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-zinc-700 dark:text-zinc-300">{children}</p>;
}

export function HelpList({ items, ordered }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  const listClass = ordered
    ? "list-decimal space-y-2 pl-5 text-sm leading-7 text-zinc-700 dark:text-zinc-300"
    : "list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-700 dark:text-zinc-300";
  return (
    <Tag className={listClass}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  );
}

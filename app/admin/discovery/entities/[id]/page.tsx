import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EntityHintStatusButtons } from "../entity-hint-status-buttons";

export const dynamic = "force-dynamic";

function formatJson(value: unknown): string {
  if (value == null) {
    return "—";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default async function AdminDiscoveryEntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await prisma.entityHint.findUnique({
    where: { id },
    include: {
      sourceSignal: {
        select: {
          id: true,
          title: true,
          url: true,
          sourceName: true,
          signalType: true,
          status: true,
        },
      },
    },
  });

  if (!row) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery/entities" className="underline">
          ← Entity Hints
        </Link>
      </p>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{row.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {row.entityType} · {row.status}
          {typeof row.confidence === "number" ? ` · confidence ${row.confidence.toFixed(2)}` : ""}
        </p>
      </header>

      <EntityHintStatusButtons hintId={row.id} currentStatus={row.status} />

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">基本信息</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">normalizedName</dt>
            <dd>{row.normalizedName}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">discoveryScopes</dt>
            <dd>{formatJson(row.discoveryScopes)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">reason</dt>
            <dd>{row.reason ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">sourceTextSnippet</dt>
            <dd className="whitespace-pre-wrap">{row.sourceTextSnippet ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">来源 Signal</h2>
        {row.sourceSignal ? (
          <div className="mt-3 space-y-2 text-sm">
            <p>
              <Link
                href={`/admin/discovery/signals/${row.sourceSignal.id}`}
                className="underline"
              >
                {row.sourceSignal.title}
              </Link>
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {row.sourceSignal.sourceName} · {row.sourceSignal.signalType} ·{" "}
              {row.sourceSignal.status}
            </p>
            {row.sourceUrl ? (
              <a
                href={row.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline dark:text-blue-400"
              >
                {row.sourceUrl}
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">无关联 Signal</p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">evidenceJson</h2>
        <pre className="mt-3 max-h-96 overflow-auto rounded bg-zinc-950 p-3 text-xs text-zinc-100">
          {formatJson(row.evidenceJson)}
        </pre>
      </section>
    </div>
  );
}

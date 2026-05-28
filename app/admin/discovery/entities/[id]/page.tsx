import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseAiJudgeEvidence } from "@/lib/discovery/entity/ai-entity-judge";
import { isEntityFeedbackEnabled } from "@/lib/discovery/discovery-feature-flags";
import { EntityHintFeedbackHistory } from "../entity-hint-feedback-history";
import { EntityHintFeedbackPanel } from "../entity-hint-feedback-panel";
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
          metadataJson: true,
        },
      },
    },
  });

  if (!row) {
    notFound();
  }

  const aiEv = parseAiJudgeEvidence(row.evidenceJson);
  const pageUrl = aiEv.pageUrl || row.sourceUrl;
  const feedbackEnabled = isEntityFeedbackEnabled();

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
          {aiEv.isAiJudge ? (
            <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              AI Entity Judge
            </span>
          ) : null}
        </p>
      </header>

      {feedbackEnabled ? (
        <EntityHintFeedbackPanel hintId={row.id} />
      ) : (
        <EntityHintStatusButtons hintId={row.id} currentStatus={row.status} />
      )}

      {feedbackEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">其他状态：</span>
          <EntityHintStatusButtons hintId={row.id} currentStatus={row.status} />
        </div>
      ) : null}

      {feedbackEnabled ? <EntityHintFeedbackHistory hintId={row.id} /> : null}

      {aiEv.isAiJudge ? (
        <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
          <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-100">
            AI Entity Judge
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">publishingAiRelevance</dt>
              <dd>{aiEv.publishingAiRelevance?.toFixed(2) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">model</dt>
              <dd className="font-mono text-xs">{aiEv.model ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">AI 判断理由</dt>
              <dd className="whitespace-pre-wrap">{aiEv.aiReason ?? row.reason ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">evidence</dt>
              <dd className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {aiEv.aiEvidence ?? row.sourceTextSnippet ?? "—"}
              </dd>
            </div>
            {aiEv.matchedKeywords?.length ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-zinc-500">matchedKeywords</dt>
                <dd>{aiEv.matchedKeywords.join("、")}</dd>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">source pageUrl</dt>
              <dd className="break-all">
                {pageUrl ? (
                  <a
                    href={pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline dark:text-blue-400"
                  >
                    {pageUrl}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          {pageUrl ? (
            <a
              href={pageUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded border border-violet-600 px-3 py-1.5 text-sm text-violet-800 dark:border-violet-500 dark:text-violet-200"
            >
              打开原文
            </a>
          ) : null}
        </section>
      ) : null}

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

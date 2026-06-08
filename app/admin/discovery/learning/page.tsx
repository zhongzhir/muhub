import Link from "next/link";
import { readDiscoveryLearningAnalytics } from "@/lib/discovery/learning-analytics";

export const dynamic = "force-dynamic";

function formatReasons(items: Array<{ tag: string; count: number }>): string {
  return items.length ? items.map((item) => `${item.tag} ${item.count}`).join(", ") : "-";
}

export default async function AdminDiscoveryLearningPage() {
  const analytics = await readDiscoveryLearningAnalytics();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-zinc-500">
          <Link href="/admin/discovery" className="underline">
            Discovery
          </Link>{" "}
          / Learning
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Discovery Learning</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Human feedback analytics for source quality, entity type quality, and noise patterns.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">Learning Suggestions</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          {analytics.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">Source Performance</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-950/60">
              <tr>
                <th className="px-3 py-2">sourceKey</th>
                <th className="px-3 py-2">Signals</th>
                <th className="px-3 py-2">Entities</th>
                <th className="px-3 py-2">ACCEPT</th>
                <th className="px-3 py-2">REJECT</th>
                <th className="px-3 py-2">MERGE</th>
                <th className="px-3 py-2">Accept rate</th>
                <th className="px-3 py-2">Reject rate</th>
                <th className="px-3 py-2">Top reject reasons</th>
              </tr>
            </thead>
            <tbody>
              {analytics.sourcePerformance.map((row) => (
                <tr key={row.sourceKey} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs">{row.sourceKey}</div>
                    <div className="text-xs text-zinc-500">{row.sourceName}</div>
                  </td>
                  <td className="px-3 py-2">{row.signalCount}</td>
                  <td className="px-3 py-2">{row.entityCount}</td>
                  <td className="px-3 py-2">{row.acceptCount}</td>
                  <td className="px-3 py-2">{row.rejectCount}</td>
                  <td className="px-3 py-2">{row.mergeCount}</td>
                  <td className="px-3 py-2">{row.acceptRate}%</td>
                  <td className="px-3 py-2">{row.rejectRate}%</td>
                  <td className="px-3 py-2 text-xs">{formatReasons(row.topRejectReasons)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">Entity Type Performance</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-950/60">
              <tr>
                <th className="px-3 py-2">entityType</th>
                <th className="px-3 py-2">Count</th>
                <th className="px-3 py-2">Accepted</th>
                <th className="px-3 py-2">Rejected</th>
                <th className="px-3 py-2">Accept rate</th>
                <th className="px-3 py-2">Top reject reasons</th>
              </tr>
            </thead>
            <tbody>
              {analytics.entityTypePerformance.map((row) => (
                <tr key={row.entityType} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">{row.entityType}</td>
                  <td className="px-3 py-2">{row.count}</td>
                  <td className="px-3 py-2">{row.accepted}</td>
                  <td className="px-3 py-2">{row.rejected}</td>
                  <td className="px-3 py-2">{row.acceptRate}%</td>
                  <td className="px-3 py-2 text-xs">{formatReasons(row.topRejectReasons)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold">Noise Patterns</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {analytics.noisePatterns.length ? (
            analytics.noisePatterns.map((item) => (
              <span key={item.tag} className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                {item.tag}: {item.count}
              </span>
            ))
          ) : (
            <span className="text-zinc-500">No structured noise tags yet.</span>
          )}
        </div>
      </section>
    </div>
  );
}

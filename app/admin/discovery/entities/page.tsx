import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DISCOVERY_SCOPES } from "@/lib/discovery/discovery-scopes";
import { ENTITY_HINT_STATUSES, ENTITY_TYPES } from "@/lib/discovery/entity/types";
import { EntityHintStatusButtons } from "./entity-hint-status-buttons";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function statusBadgeClass(status: string): string {
  if (status === "PENDING") {
    return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (status === "ACCEPTED") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (status === "MERGED_LATER") {
    return "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200";
  }
  return "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
}

function buildHref(input: {
  status: string;
  entityType: string;
  scope: string;
  q: string;
}): string {
  const params = new URLSearchParams();
  if (input.status !== "ALL") {
    params.set("status", input.status);
  }
  if (input.entityType !== "ALL") {
    params.set("entityType", input.entityType);
  }
  if (input.scope !== "ALL") {
    params.set("scope", input.scope);
  }
  if (input.q) {
    params.set("q", input.q);
  }
  return `/admin/discovery/entities${params.toString() ? `?${params.toString()}` : ""}`;
}

function formatScopes(scopes: unknown): string {
  if (!Array.isArray(scopes)) {
    return "—";
  }
  const items = scopes.filter((s): s is string => typeof s === "string");
  return items.length > 0 ? items.join(", ") : "—";
}

export default async function AdminDiscoveryEntitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const statusRaw = typeof sp.status === "string" ? sp.status.toUpperCase() : "ALL";
  const entityTypeRaw = typeof sp.entityType === "string" ? sp.entityType.toUpperCase() : "ALL";
  const scopeRaw = typeof sp.scope === "string" ? sp.scope : "ALL";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const status =
    statusRaw === "PENDING" ||
    statusRaw === "ACCEPTED" ||
    statusRaw === "REJECTED" ||
    statusRaw === "MERGED_LATER"
      ? statusRaw
      : "ALL";
  const entityType = (ENTITY_TYPES as readonly string[]).includes(entityTypeRaw)
    ? entityTypeRaw
    : "ALL";
  const scope = (DISCOVERY_SCOPES as readonly string[]).includes(scopeRaw) ? scopeRaw : "ALL";

  const where: Prisma.EntityHintWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(entityType !== "ALL" ? { entityType } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sourceTitle: { contains: q, mode: "insensitive" } },
            { reason: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await prisma.entityHint.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      sourceSignal: {
        select: { id: true, sourceName: true, signalType: true },
      },
    },
  });

  const filteredRows =
    scope === "ALL"
      ? rows
      : rows.filter((row) => {
          if (!Array.isArray(row.discoveryScopes)) {
            return false;
          }
          return (row.discoveryScopes as unknown[]).includes(scope);
        });

  const [total, pending] = await Promise.all([
    prisma.entityHint.count(),
    prisma.entityHint.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery" className="underline">
          ← Discovery
        </Link>
      </p>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Entity Hints（E1）</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          从 Signal 抽取的实体线索；不要求完整 Project 字段。总计 {total} 条，待审 {pending} 条。
        </p>
      </header>

      <section className="flex flex-wrap gap-2 text-sm">
        <span className="text-zinc-500">状态：</span>
        {(["ALL", ...ENTITY_HINT_STATUSES] as const).map((value) => (
          <Link
            key={value}
            href={buildHref({ status: value, entityType, scope, q })}
            className={`rounded-full border px-2.5 py-0.5 ${
              status === value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {value}
          </Link>
        ))}
      </section>

      <section className="flex flex-wrap gap-2 text-sm">
        <span className="text-zinc-500">类型：</span>
        {(["ALL", ...ENTITY_TYPES] as const).map((value) => (
          <Link
            key={value}
            href={buildHref({ status, entityType: value, scope, q })}
            className={`rounded-full border px-2.5 py-0.5 ${
              entityType === value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {value}
          </Link>
        ))}
      </section>

      <section className="flex flex-wrap gap-2 text-sm">
        <span className="text-zinc-500">Scope：</span>
        {(["ALL", ...DISCOVERY_SCOPES] as const).map((value) => (
          <Link
            key={value}
            href={buildHref({ status, entityType, scope: value, q })}
            className={`rounded-full border px-2.5 py-0.5 ${
              scope === value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {value}
          </Link>
        ))}
      </section>

      <form method="get" className="flex flex-wrap items-center gap-2">
        {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
        {entityType !== "ALL" ? <input type="hidden" name="entityType" value={entityType} /> : null}
        {scope !== "ALL" ? <input type="hidden" name="scope" value={scope} /> : null}
        <input
          name="q"
          defaultValue={q}
          placeholder="搜索名称、来源标题、reason"
          className="min-w-[240px] rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
        >
          搜索
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900/60">
            <tr>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">类型</th>
              <th className="px-3 py-2">置信度</th>
              <th className="px-3 py-2">状态</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">来源</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">时间</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                  暂无 Entity Hint。可运行{" "}
                  <code className="text-xs">
                    pnpm tsx scripts/extract-entity-hints.ts --scope publishing_ai --limit 50
                  </code>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-zinc-100 dark:border-zinc-800/80"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/discovery/entities/${row.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.entityType}</td>
                  <td className="px-3 py-2">
                    {typeof row.confidence === "number" ? row.confidence.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{formatScopes(row.discoveryScopes)}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.sourceSignal ? (
                      <Link
                        href={`/admin/discovery/signals/${row.sourceSignal.id}`}
                        className="underline"
                      >
                        {row.sourceSignal.sourceName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {row.reason ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {row.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <EntityHintStatusButtons hintId={row.id} currentStatus={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

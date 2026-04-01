"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DISCOVERY_SOURCE_TYPES } from "@/lib/discovery/candidate-list-query";

const REVIEW = ["PENDING", "APPROVED", "REJECTED", "IGNORED", "MERGED"] as const;
const IMPORT = ["PENDING", "IMPORTED", "SKIPPED", "FAILED"] as const;

type SourceOpt = { key: string; name: string };

export function DiscoveryListFilters(props: {
  sources: SourceOpt[];
  paramString: string;
}) {
  const { sources, paramString } = props;
  const router = useRouter();
  const cur = useMemo(() => new URLSearchParams(paramString), [paramString]);

  const reviewStatus = cur.get("reviewStatus") ?? "";
  const importStatus = cur.get("importStatus") ?? "";
  const sourceKey = cur.get("sourceKey") ?? "";
  const sourceType = cur.get("sourceType") ?? "";
  const externalType = cur.get("externalType") ?? "";
  const [extType, setExtType] = useState(externalType);

  const navigate = (patch: Record<string, string | undefined | null>) => {
    const u = new URLSearchParams(paramString);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === "") {
        u.delete(k);
      } else {
        u.set(k, v);
      }
    }
    u.set("page", "1");
    router.push(`/admin/discovery?${u.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-zinc-500">审核</span>
        <select
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
          value={reviewStatus}
          onChange={(e) => navigate({ reviewStatus: e.target.value || undefined })}
        >
          <option value="">全部</option>
          {REVIEW.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-zinc-500">导入</span>
        <select
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
          value={importStatus}
          onChange={(e) => navigate({ importStatus: e.target.value || undefined })}
        >
          <option value="">全部</option>
          {IMPORT.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-zinc-500">来源 key</span>
        <select
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
          value={sourceKey}
          onChange={(e) => navigate({ sourceKey: e.target.value || undefined })}
        >
          <option value="">全部</option>
          {sources.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name} ({s.key})
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-zinc-500">来源类型</span>
        <select
          className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
          value={sourceType}
          onChange={(e) => navigate({ sourceType: e.target.value || undefined })}
        >
          <option value="">全部</option>
          {DISCOVERY_SOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-zinc-500">类型</span>
        <input
          className="w-28 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="github / producthunt_product"
          value={extType}
          onChange={(e) => setExtType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              navigate({ externalType: extType.trim() || undefined });
            }
          }}
        />
        <button
          type="button"
          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
          onClick={() => navigate({ externalType: extType.trim() || undefined })}
        >
          应用
        </button>
      </label>
      <span className="text-zinc-500">
        排序：
        <Link
          className="ml-2 underline"
          href={buildSortHref(paramString, "score", "desc")}
        >
          分数↓
        </Link>
        <span className="mx-1 text-zinc-300">|</span>
        <Link
          className="underline"
          href={buildSortHref(paramString, "reviewPriority", "desc")}
        >
          审核优先级↓
        </Link>
        <span className="mx-1 text-zinc-300">|</span>
        <Link className="underline" href={buildSortHref(paramString, "stars", "desc")}>
          stars↓
        </Link>
        <span className="mx-1 text-zinc-300">|</span>
        <Link className="underline" href={buildSortHref(paramString, "lastSeenAt", "desc")}>
          lastSeen↓
        </Link>
        <span className="mx-1 text-zinc-300">|</span>
        <Link className="underline" href={buildSortHref(paramString, "repoUpdatedAt", "desc")}>
          repoUpd↓
        </Link>
        <span className="mx-1 text-zinc-300">|</span>
        <Link className="underline" href={buildSortHref(paramString, "firstSeenAt", "desc")}>
          firstSeen↓
        </Link>
      </span>
    </div>
  );
}

function buildSortHref(paramString: string, sort: string, order: string): string {
  const u = new URLSearchParams(paramString);
  u.set("sort", sort);
  u.set("order", order);
  u.set("page", "1");
  const q = u.toString();
  return q ? `/admin/discovery?${q}` : "/admin/discovery";
}

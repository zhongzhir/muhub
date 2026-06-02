import Link from "next/link";
import {
  isHumanFeedbackRecord,
  isVerificationFeedbackRecord,
  readDiscoveryFeedbackRecords,
  summarizeDiscoveryFeedback,
  type DiscoveryFeedbackRecord,
} from "@/lib/discovery/feedback-capture";
import { DiscoveryHubNav } from "../discovery-hub-nav";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const DECISION_LABELS: Record<string, string> = {
  ACCEPT: "接受",
  REJECT: "拒绝",
  RETYPE: "修改类型",
  CHANGE_PRIMARY_SOURCE: "修改来源",
  MERGE: "待合并",
  NEEDS_REVIEW: "待观察",
};

const REASON_LABELS: Record<string, string> = {
  official_source_exists: "官方来源存在",
  github_exists: "GitHub存在",
  huggingface_exists: "HuggingFace存在",
  website_exists: "官网存在",
  multi_source_verified: "多源验证",
  high_project_value: "项目价值高",
  high_industry_attention: "行业关注度高",
  concept_only: "只是概念",
  method_only: "只是方法",
  no_official_source: "没有官方来源",
  ambiguous_name: "名称歧义",
  duplicate_project: "重复项目",
  insufficient_information: "信息不足",
  ai_misidentified: "AI误识别",
  found_more_trusted_source: "找到更可信来源",
  official_source: "官方来源",
  github_source: "GitHub",
  huggingface_source: "HuggingFace",
  website_source: "官网",
  other: "其它",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function limitFromSearchParams(value: string | string[] | undefined): number {
  const parsed = Number(firstParam(value));
  return parsed === 1000 ? 1000 : 100;
}

function scopeFromSearchParams(value: string | string[] | undefined): "human" | "system" | "all" {
  const raw = firstParam(value);
  return raw === "system" || raw === "all" ? raw : "human";
}

function buildHref(input: { scope: "human" | "system" | "all"; limit: number; includeTest: boolean }) {
  const params = new URLSearchParams();
  if (input.scope !== "human") {
    params.set("scope", input.scope);
  }
  if (input.limit === 1000) {
    params.set("limit", "1000");
  }
  if (input.includeTest) {
    params.set("includeTest", "1");
  }
  return `/admin/discovery/feedback${params.toString() ? `?${params.toString()}` : ""}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function decisionClass(decision: string): string {
  if (decision === "ACCEPT") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
  }
  if (decision === "REJECT") {
    return "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200";
  }
  if (decision === "CHANGE_PRIMARY_SOURCE" || decision === "RETYPE") {
    return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
}

function recordSourceLabel(row: DiscoveryFeedbackRecord): string {
  if (isVerificationFeedbackRecord(row)) {
    return "测试/维护";
  }
  if (row.isHumanDecision === false || row.decisionSource === "system_rule") {
    return "系统规则";
  }
  return "人工判断";
}

function filterRecords(
  records: DiscoveryFeedbackRecord[],
  scope: "human" | "system" | "all",
  includeTest: boolean,
): DiscoveryFeedbackRecord[] {
  return records.filter((record) => {
    if (!includeTest && isVerificationFeedbackRecord(record)) {
      return false;
    }
    if (scope === "human") {
      return isHumanFeedbackRecord(record);
    }
    if (scope === "system") {
      return record.isHumanDecision === false || record.decisionSource === "system_rule";
    }
    return true;
  });
}

function StatList({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">暂无数据</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3">
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {REASON_LABELS[row.label] ?? row.label}
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {row.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedbackRow({ row }: { row: DiscoveryFeedbackRecord }) {
  const candidateId = row.context?.discoveryCandidateId;
  return (
    <tr className="border-t border-zinc-100 align-top dark:border-zinc-800">
      <td className="px-3 py-3 text-xs text-zinc-500">{formatTime(row.timestamp)}</td>
      <td className="px-3 py-3">
        <div className="font-medium text-zinc-900 dark:text-zinc-100">
          {candidateId ? (
            <Link href={`/admin/discovery/${candidateId}`} className="underline-offset-2 hover:underline">
              {row.entityName}
            </Link>
          ) : (
            row.entityName
          )}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          {row.originalEntityType ?? "-"} {"->"} {row.finalEntityType ?? "-"}
        </div>
        <div className="mt-1 text-xs text-zinc-400">
          {row.originalStatus ?? "-"} {"->"} {row.finalStatus ?? "-"}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className={`rounded-full border px-2 py-0.5 text-xs ${decisionClass(row.finalDecision)}`}>
          {DECISION_LABELS[row.finalDecision] ?? row.finalDecision}
        </span>
        <div className="mt-2 text-xs text-zinc-500">{recordSourceLabel(row)}</div>
        {row.entityHintId ? <div className="mt-1 text-xs text-zinc-400">{row.entityHintId}</div> : null}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
        {row.reasonTags.length ? (
          <div className="flex max-w-md flex-wrap gap-1">
            {row.reasonTags.map((tag) => (
              <span key={tag} className="rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-700">
                {REASON_LABELS[tag] ?? tag}
              </span>
            ))}
          </div>
        ) : (
          "-"
        )}
        {row.comment ? <p className="mt-2 max-w-md leading-relaxed">{row.comment}</p> : null}
      </td>
      <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
        <div className="max-w-xs break-all">
          {row.sourceTitle ? <div className="mb-1 text-zinc-500">{row.sourceTitle}</div> : null}
          {row.originalPrimarySource ?? row.sourceUrl ?? "-"}
          {row.sourceLevel ? <div className="mt-1 text-zinc-400">sourceLevel={row.sourceLevel}</div> : null}
        </div>
      </td>
      <td className="px-3 py-3 text-xs text-zinc-500">{row.operator ?? "-"}</td>
    </tr>
  );
}

export default async function AdminDiscoveryFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const limit = limitFromSearchParams(sp.limit);
  const scope = scopeFromSearchParams(sp.scope);
  const includeTest = firstParam(sp.includeTest) === "1";
  const allRecords = await readDiscoveryFeedbackRecords(limit * 5);
  const records = filterRecords(allRecords, scope, includeTest).slice(0, limit);
  const summary = summarizeDiscoveryFeedback(records);

  return (
    <div className="space-y-6">
      <DiscoveryHubNav current="feedback" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Discovery Feedback Viewer</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            默认只展示人工判断，并隐藏 verification / admin-data-fix 样本。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["human", "system", "all"] as const).map((value) => (
            <Link
              key={value}
              href={buildHref({ scope: value, limit, includeTest })}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                scope === value ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
              }`}
            >
              {value === "human" ? "仅人工" : value === "system" ? "系统规则" : "全部"}
            </Link>
          ))}
          {[100, 1000].map((value) => (
            <Link
              key={value}
              href={buildHref({ scope, limit: value, includeTest })}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                limit === value ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"
              }`}
            >
              最近 {value}
            </Link>
          ))}
          <Link
            href={buildHref({ scope, limit, includeTest: !includeTest })}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              includeTest ? "border-amber-700 bg-amber-50 text-amber-800" : "border-zinc-300"
            }`}
          >
            {includeTest ? "已包含测试" : "包含测试记录"}
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {["ACCEPT", "REJECT", "RETYPE", "CHANGE_PRIMARY_SOURCE", "MERGE"].map((decision) => (
          <div
            key={decision}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <p className="text-xs text-zinc-500">{DECISION_LABELS[decision] ?? decision}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {summary.byDecision[decision] ?? 0}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatList title="Top Reject Reasons" rows={summary.topRejectReasons} />
        <StatList title="Top Retype Reasons" rows={summary.topRetypeReasons} />
        <StatList title="Top Source Changes" rows={summary.topSourceChanges} />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">反馈样本</h2>
          <p className="mt-1 text-xs text-zinc-500">
            当前显示 {records.length} 条，筛选：{scope}，测试记录：{includeTest ? "包含" : "隐藏"}
          </p>
        </div>
        {records.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">暂无反馈样本。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-950/50">
                <tr>
                  <th className="px-3 py-2 font-medium">时间</th>
                  <th className="px-3 py-2 font-medium">实体</th>
                  <th className="px-3 py-2 font-medium">决策</th>
                  <th className="px-3 py-2 font-medium">原因</th>
                  <th className="px-3 py-2 font-medium">来源</th>
                  <th className="px-3 py-2 font-medium">操作者</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <FeedbackRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

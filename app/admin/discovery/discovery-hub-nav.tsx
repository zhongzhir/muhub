import Link from "next/link";

export type DiscoveryHubSection =
  | "sources"
  | "signals"
  | "entities"
  | "candidates"
  | "daily"
  | "tasks";

type NavItem = {
  id: DiscoveryHubSection;
  href: string;
  label: string;
  hint: string;
};

const PRIMARY_FLOW: NavItem[] = [
  {
    id: "sources",
    href: "/admin/discovery/sources",
    label: "1. 信息源",
    hint: "Source Network — 维护 RSS/名单/官网等来源",
  },
  {
    id: "signals",
    href: "/admin/discovery/signals",
    label: "2. 线索池",
    hint: "Signal — RSS/新闻/公告等原始条目",
  },
  {
    id: "entities",
    href: "/admin/discovery/entities",
    label: "3. 实体线索",
    hint: "Entity Hint (E1) — 从 Signal 抽取机构/实验室/项目名",
  },
  {
    id: "candidates",
    href: "/admin/discovery",
    label: "4. 候选项目",
    hint: "Candidate — 审核后导入正式 Project",
  },
];

const SECONDARY: NavItem[] = [
  {
    id: "daily",
    href: "/admin/discovery/daily",
    label: "今日工作台",
    hint: "AI 发现日汇总",
  },
  {
    id: "tasks",
    href: "/admin/discovery/tasks",
    label: "抓取任务",
    hint: "手动触发 Source Run",
  },
];

function navClass(active: boolean): string {
  return active
    ? "border-teal-600 bg-teal-50 text-teal-900 dark:border-teal-700 dark:bg-teal-950/50 dark:text-teal-100"
    : "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300";
}

export function DiscoveryHubNav({ current }: { current: DiscoveryHubSection }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Discovery 运营导航
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-zinc-600 dark:text-zinc-400">
            出版 AI（publishing_ai）推荐路径：维护信息源 → 查看 Signal →（可选）抽取 Entity
            Hint → 审核 Candidate → 导入 Project。运营文档见{" "}
            <code className="text-[11px]">docs/discovery/discovery-runbook.md</code>
            。Entity E2 暂缓，当前 E1 仅作线索池。
          </p>
        </div>
        <Link
          href="/admin/projects"
          className="shrink-0 text-xs text-zinc-500 underline-offset-2 hover:underline"
        >
          已导入项目 →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRIMARY_FLOW.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            title={item.hint}
            className={`rounded-lg border px-3 py-1.5 text-sm ${navClass(current === item.id)}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <span className="text-xs text-zinc-500">其他：</span>
        {SECONDARY.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            title={item.hint}
            className={`rounded-lg border px-2.5 py-1 text-xs ${navClass(current === item.id)}`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/admin/discovery/items"
          className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          JSON 队列（遗留）
        </Link>
        <Link
          href="/admin/discovery/mobile"
          className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
        >
          手机采集
        </Link>
      </div>
    </section>
  );
}

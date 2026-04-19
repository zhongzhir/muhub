import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminDiscoveryTasksPage() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery" className="underline-offset-4 hover:underline">
          ← 候选列表
        </Link>
      </p>
      <section className="muhub-card space-y-3 p-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">抓取与任务</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          本页为「项目筛选」子模块骨架。单次抓取运行、JSON 队列与来源触发仍可在以下入口操作：
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
          <li>
            <Link href="/admin/discovery" className="text-blue-600 underline dark:text-blue-400">
              候选列表
            </Link>
            — 顶部运行栏与筛选
          </li>
          <li>
            <Link href="/admin/discovery/items" className="text-blue-600 underline dark:text-blue-400">
              JSON 队列
            </Link>
            — 内容管线与批量任务
          </li>
          <li>
            <Link href="/admin/discovery/sources" className="text-blue-600 underline dark:text-blue-400">
              来源管理
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

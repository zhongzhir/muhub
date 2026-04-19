import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";

export const dynamic = "force-dynamic";

export default async function AdminProjectActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.project.findFirst({
    where: { id, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, name: true, slug: true },
  });
  if (!row) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/projects" className="underline-offset-4 hover:underline">
          ← 项目列表
        </Link>
        {" · "}
        <Link href={`/admin/projects/${row.id}/edit`} className="underline-offset-4 hover:underline">
          编辑项目
        </Link>
      </p>
      <section className="muhub-card space-y-3 p-6">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">项目动态</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">项目：{row.name}</p>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40">
          动态时间线、导入记录与运营备注将在此聚合展示。当前为占位页，后续阶段接入活动数据与筛选。
        </div>
      </section>
    </div>
  );
}

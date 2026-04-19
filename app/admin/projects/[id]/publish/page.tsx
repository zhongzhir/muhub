import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PROJECT_ACTIVE_FILTER } from "@/lib/project-active-filter";

export const dynamic = "force-dynamic";

export default async function AdminProjectPublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.project.findFirst({
    where: { id, ...PROJECT_ACTIVE_FILTER },
    select: { id: true, name: true, slug: true, status: true, visibilityStatus: true },
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
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">发布与可见性</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          当前项目：<span className="font-medium">{row.name}</span>
          <span className="ml-2 font-mono text-xs text-zinc-500">({row.slug})</span>
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          状态：<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{row.status}</code>
          {" · "}
          可见性：<code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">{row.visibilityStatus}</code>
        </p>
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40">
          本页为骨架占位。正式发布请在
          {" "}
          <Link href={`/admin/projects/${row.id}/edit`} className="font-medium text-blue-600 underline dark:text-blue-400">
            项目编辑页
          </Link>
          使用「发布项目」按钮完成。
        </div>
      </section>
    </div>
  );
}

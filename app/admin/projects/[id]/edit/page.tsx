import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAdminProjectForEdit } from "@/lib/admin-project-edit";
import { AdminProjectEditForm } from "./admin-project-edit-form";

export const dynamic = "force-dynamic";

export default async function AdminProjectEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchAdminProjectForEdit(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
        <Link href="/admin/projects" className="underline-offset-4 hover:underline">
          返回项目列表
        </Link>
        <Link href="/admin/discovery" className="underline-offset-4 hover:underline">
          Discovery 候选
        </Link>
        <Link href={`/admin/projects/${project.id}/publish`} className="underline-offset-4 hover:underline">
          发布与可见性
        </Link>
        <Link href={`/admin/projects/${project.id}/activity`} className="underline-offset-4 hover:underline">
          项目动态
        </Link>
        <Link href={`/projects/${project.slug}`} className="underline-offset-4 hover:underline">
          查看前台项目页
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          项目编辑
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          打通从待筛选项目收录到发布的主流程，营销能力在后续“项目营销中心”中承接。
        </p>
      </header>

      <AdminProjectEditForm key={project.dataUpdatedAt} initial={project} />
    </div>
  );
}

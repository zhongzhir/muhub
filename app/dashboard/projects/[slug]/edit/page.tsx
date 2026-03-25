import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectForEdit } from "@/lib/project-edit";
import { EditProjectForm } from "./edit-project-form";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function EditProjectPage({ params }: PageProps) {
  const { slug } = await params;

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">无法编辑项目</p>
          <p className="mt-2">请先在 <code className="rounded bg-amber-100/80 px-1 py-0.5 dark:bg-amber-900/60">.env</code> 中配置 <strong>DATABASE_URL</strong> 后重试。</p>
          <p className="mt-4">
            <Link href="/" className="underline underline-offset-4">
              返回首页
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const initial = await fetchProjectForEdit(slug);
  if (!initial) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-xl px-6 py-12">
        <p className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <Link href={`/projects/${slug}`} className="underline-offset-4 hover:underline">
            返回项目页
          </Link>
          <Link href={`/dashboard/projects/${slug}/updates/new`} className="underline-offset-4 hover:underline">
            发布动态
          </Link>
        </p>
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">编辑项目</h1>
        <EditProjectForm initial={initial} />
      </div>
    </div>
  );
}

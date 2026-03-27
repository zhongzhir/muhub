import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { canManageProject } from "@/lib/project-permissions";
import { prisma } from "@/lib/prisma";
import { normalizeProjectSlugParam } from "@/lib/route-slug";
import { PublishUpdateForm } from "./publish-update-form";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function NewProjectUpdatePage({ params }: PageProps) {
  const slug = normalizeProjectSlugParam((await params).slug);

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">无法发布动态</p>
          <p className="mt-2">
            请先在 <code className="rounded bg-amber-100/80 px-1 py-0.5 dark:bg-amber-900/60">.env</code> 中配置{" "}
            <strong>DATABASE_URL</strong> 后重试。
          </p>
          <p className="mt-4">
            <Link href="/" className="underline underline-offset-4">
              返回首页
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const exists = await prisma.project.findUnique({
    where: { slug },
    select: { slug: true, name: true, createdById: true, claimedByUserId: true },
  });

  if (!exists) {
    notFound();
  }

  const session = await auth();
  if (!canManageProject(session?.user?.id, exists)) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="mx-auto max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">无法发布动态</p>
          <p className="mt-2">仅项目创建者或认领者可发布动态（归属已明确的项目）。</p>
          <p className="mt-4">
            <Link href={`/projects/${slug}`} className="underline underline-offset-4">
              返回项目页
            </Link>
          </p>
        </div>
      </div>
    );
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
          <Link href={`/dashboard/projects/${slug}/edit`} className="underline-offset-4 hover:underline">
            编辑项目
          </Link>
        </p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">发布项目动态</h1>
        <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
          {exists.name}{" "}
          <span className="text-zinc-500">
            （页面路径 <span className="font-mono break-all">{exists.slug}</span>）
          </span>
        </p>
        <PublishUpdateForm slug={slug} />
      </div>
    </div>
  );
}

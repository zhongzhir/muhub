import Link from "next/link";
import { NewProjectForm } from "./new-project-form";
import { resolveNewProjectPrefillAsync } from "./prefill";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const prefill = await resolveNewProjectPrefillAsync(sp);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-xl px-6 py-12">
        <p className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <Link href="/dashboard/projects/import" className="underline-offset-4 hover:underline">
            从 GitHub 导入
          </Link>
        </p>
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">创建项目</h1>
        <NewProjectForm prefill={prefill} />
      </div>
    </div>
  );
}

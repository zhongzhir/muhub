import Link from "next/link";
import { redirect } from "next/navigation";
import { getEnabledProjectSources } from "@/agents/sources/source-registry";
import { auth } from "@/auth";
import { ImportExternalProjectForm } from "./import-external-project-form";

export const dynamic = "force-dynamic";

export default async function ImportExternalProjectPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/import-project");
  }

  const sources = getEnabledProjectSources();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-xl px-6 py-12">
        <p className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            我的项目
          </Link>
          <Link href="/dashboard/projects/new" className="underline-offset-4 hover:underline">
            创建项目
          </Link>
        </p>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">导入外部项目</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            将 GitHub、Gitee、社区、产业园、展会等来源的项目录入 MUHUB。面向维护者与内部运营的轻量入口（V1.1）；来源清单由静态注册表驱动，便于后续接自动化发现。
          </p>
        </header>
        <ImportExternalProjectForm sources={sources} />
      </div>
    </div>
  );
}

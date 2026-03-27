import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProjectCard } from "@/components/project-card";
import { fetchMyClaimedProjects, fetchMyCreatedProjects } from "@/lib/my-projects";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const userId = session.user.id;
  const [created, claimed] = await Promise.all([
    fetchMyCreatedProjects(userId),
    fetchMyClaimedProjects(userId),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <span className="mx-2 text-zinc-300">·</span>
          <Link href="/projects" className="underline-offset-4 hover:underline">
            浏览项目
          </Link>
        </p>

        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">我的的项目</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            这里汇总你创建与认领的项目。认领通过后，你可与创建者权限一致地维护资料与动态（具体以项目归属为准）。
          </p>
        </header>

        <section className="mb-14" aria-labelledby="created-heading">
          <h2 id="created-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            我创建的项目
          </h2>
          {created.length === 0 ? (
            <div
              className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-600 dark:bg-zinc-900/40"
              data-testid="dashboard-empty-created"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">还没有创建过项目。</p>
              <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/dashboard/projects/new"
                  className="inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto"
                >
                  创建项目
                </Link>
                <Link
                  href="/dashboard/projects/import"
                  className="inline-flex w-full max-w-xs items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 sm:w-auto"
                >
                  从 GitHub 导入
                </Link>
              </div>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {created.map((p) => (
                <li key={p.slug}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="claimed-heading">
          <h2 id="claimed-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            我认领的项目
          </h2>
          {claimed.length === 0 ? (
            <div
              className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-600 dark:bg-zinc-900/40"
              data-testid="dashboard-empty-claimed"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                尚未认领项目。在公开项目页可发起仓库认领（需登录）。
              </p>
              <p className="mt-4">
                <Link
                  href="/projects"
                  className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  去项目广场
                </Link>
              </p>
            </div>
          ) : (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {claimed.map((p) => (
                <li key={p.slug}>
                  <ProjectCard project={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

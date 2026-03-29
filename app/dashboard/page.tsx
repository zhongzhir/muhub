import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ProjectCard } from "@/components/project-card";
import { FollowingUpdatesPanel } from "@/components/notifications/following-updates-panel";
import {
  fetchMyClaimedProjects,
  fetchMyCreatedProjects,
  mergeMyProjectRows,
} from "@/lib/my-projects";
import { getRecentFollowingUpdateNotificationsForUser } from "@/lib/project-notifications";

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
  const projects = mergeMyProjectRows(created, claimed);
  const notifRows = await getRecentFollowingUpdateNotificationsForUser(userId, 8);
  const notificationsForPanel = notifRows.map((n) => ({
    id: n.id,
    projectSlug: n.projectSlug,
    projectName: n.projectName,
    eventTitle: n.eventTitle,
    message: n.message,
    createdAtIso: n.createdAt.toISOString(),
    readAtIso: n.readAt ? n.readAt.toISOString() : null,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/projects" className="underline-offset-4 hover:underline">
            项目广场
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/dashboard/import-project" className="underline-offset-4 hover:underline">
            导入外部项目
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/dashboard/following" className="underline-offset-4 hover:underline">
            我关注的项目
          </Link>
          <span className="text-zinc-300">·</span>
          <Link
            href="/dashboard/content-drafts"
            className="text-zinc-400 underline-offset-4 hover:underline dark:text-zinc-500"
            title="内部运营：内容草稿"
          >
            内容草稿
          </Link>
          <span className="text-zinc-300">·</span>
          <Link
            href="/dashboard/growth"
            className="text-zinc-400 underline-offset-4 hover:underline dark:text-zinc-500"
            title="内部运营：增长中心 / 资产包"
          >
            增长中心
          </Link>
        </p>

        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">我的项目</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            这里汇总你创建与认领的项目。使用「管理项目」进入工作台维护资料与动态；「查看项目」打开对外公开展示页。
          </p>
        </header>

        <FollowingUpdatesPanel notifications={notificationsForPanel} />

        <section aria-labelledby="my-projects-list-heading">
          <h2 id="my-projects-list-heading" className="sr-only">
            项目列表
          </h2>
          {projects.length === 0 ? (
            <div
              className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center dark:border-zinc-600 dark:bg-zinc-900/40"
              data-testid="dashboard-empty"
            >
              <p className="text-base font-medium text-zinc-800 dark:text-zinc-200">还没有项目</p>
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
              <p className="mt-6">
                <Link
                  href="/projects"
                  className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  去项目广场
                </Link>
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {projects.map((p) => (
                <li key={p.id}>
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

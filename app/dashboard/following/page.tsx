import Link from "next/link";
import { redirect } from "next/navigation";
import { FollowingProjectRowCard } from "@/components/project/following-project-row";
import { auth } from "@/auth";
import { getFollowingProjectsForUser } from "@/lib/project-following";

export const dynamic = "force-dynamic";

export default async function FollowingProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/following");
  }

  const rows = await getFollowingProjectsForUser(session.user.id);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            我的项目
          </Link>
          <span className="text-zinc-300">·</span>
          <Link href="/projects" className="underline-offset-4 hover:underline">
            项目广场
          </Link>
        </p>

        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">我关注的项目</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            在这里查看你持续关注的项目，以及它们最近的更新。关注关系也是后续动态提醒与更多合作能力的基础（本轮仅列表与轻量活跃度，不发通知）。
          </p>
        </header>

        {rows.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center dark:border-zinc-600 dark:bg-zinc-900/40"
            data-testid="following-empty"
          >
            <p className="text-base font-medium text-zinc-800 dark:text-zinc-200">你还没有关注项目</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              在项目详情页点击「关注」，就可以在这里持续追踪它们的最新进展。
            </p>
            <Link
              href="/projects"
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              去项目广场
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((row) => (
              <li key={row.projectId}>
                <FollowingProjectRowCard row={row} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { CreateProjectMenu } from "@/components/layout/create-project-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { getUnreadFollowingNotificationCount } from "@/lib/project-notifications";

/** 与 public/brand/muhub_logo_horizontal.png 源文件比例一致 */
const HORIZONTAL_WIDTH = 530;
const HORIZONTAL_HEIGHT = 600;

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const unreadNotifyCount =
    user?.id != null ? await getUnreadFollowingNotificationCount(user.id) : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200/35 bg-white/70 backdrop-blur-md dark:border-zinc-800/35 dark:bg-zinc-950/75">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4 sm:py-2.5">
        <Link
          href="/"
          className="-m-1 flex min-w-0 shrink-0 items-center rounded-md p-1 outline-offset-2 transition hover:opacity-[0.92] focus-visible:outline focus-visible:ring-2 focus-visible:ring-teal-600/35 dark:focus-visible:ring-teal-500/40"
          aria-label="木哈布首页"
        >
          <Image
            src="/brand/muhub_logo_horizontal.png"
            alt="木哈布"
            width={HORIZONTAL_WIDTH}
            height={HORIZONTAL_HEIGHT}
            className="h-8 w-auto max-h-9 object-contain object-left md:h-9 md:max-h-10"
            priority
          />
        </Link>
        <nav
          className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-0.5 sm:gap-1"
          aria-label="主导航"
        >
          <Link
            href="/projects"
            className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 sm:px-2.5 sm:text-sm dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            项目广场
          </Link>
          <CreateProjectMenu authenticated={Boolean(user)} />
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 sm:px-2.5 sm:text-sm dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
              >
                我的项目
              </Link>
              <Link
                href="/dashboard"
                className="relative inline-flex items-center justify-center rounded-md px-1.5 py-1.5 text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 sm:px-2 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
                aria-label={
                  unreadNotifyCount > 0
                    ? `关注项目更新通知，${unreadNotifyCount} 条未读`
                    : "关注项目更新通知"
                }
                title="查看通知（跳转我的项目）"
              >
                <span className="text-base leading-none" aria-hidden>
                  🔔
                </span>
                {unreadNotifyCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm tabular-nums dark:bg-red-600">
                    {unreadNotifyCount > 99 ? "99+" : unreadNotifyCount}
                  </span>
                ) : null}
              </Link>
              <UserMenu name={user.name} email={user.email} image={user.image} phone={user.phone} />
            </>
          ) : (
            <Link
              href="/auth/signin?callbackUrl=/dashboard"
              className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100/90 hover:text-zinc-900 sm:px-2.5 sm:text-sm dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

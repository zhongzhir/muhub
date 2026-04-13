import Link from "next/link";

export function LegalPageShell({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">最后更新日期：{updatedAt}</p>
        </header>
        <article className="space-y-6 text-sm leading-7 text-zinc-700 dark:text-zinc-300">{children}</article>
      </div>
    </div>
  );
}

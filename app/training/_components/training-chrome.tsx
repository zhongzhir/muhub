import Link from "next/link";

const BRAND = {
  navy: "#1a2035",
  gold: "#c9a84c",
} as const;

export function TrainingHeader() {
  return (
    <div
      className="border-b border-zinc-200 dark:border-zinc-800"
      style={{ background: `linear-gradient(135deg, ${BRAND.navy} 0%, #243050 100%)` }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/training" className="flex items-center gap-4">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: "rgba(201,168,76,0.25)", border: "1px solid #c9a84c" }}
          >
            训
          </div>
          <div>
            <div className="text-sm font-semibold text-white">出版融合发展工程实践交流活动</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.58)" }}>
              2026 年 6 月 29 日至 7 月 3 日
            </div>
          </div>
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
            技术支持
          </span>
          <span
            className="rounded border px-2 py-0.5 text-xs font-medium"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.72)" }}
          >
            MUHUB Training
          </span>
        </div>
      </div>
    </div>
  );
}

export function TrainingNav() {
  const links = [
    { href: "/training", label: "活动首页" },
    { href: "/training/cases", label: "案例资料" },
    { href: "/training/workspace", label: "我的工作台" },
    { href: "/training/survey", label: "满意度调查" },
    { href: "/training/register", label: "身份绑定" },
  ];

  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function TrainingFooter() {
  return (
    <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center text-xs text-zinc-400 sm:flex-row sm:justify-between">
          <span>出版融合发展工程实践交流活动专项工作台</span>
          <span>
            技术支持：
            <Link href="/" className="underline underline-offset-2 hover:text-zinc-600">
              MUHUB
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

export function TrainingPageShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <TrainingHeader />
      <TrainingNav />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
          ) : null}
        </div>
        {children}
      </main>
      <TrainingFooter />
    </div>
  );
}

export function SceneTag({ tag }: { tag: string }) {
  return (
    <span className="inline-block rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
      {tag}
    </span>
  );
}

export { BRAND };

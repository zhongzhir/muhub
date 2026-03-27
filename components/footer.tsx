import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <p>
        © 木哈布 MUHUB
        <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
        <Link href="/feedback" className="underline-offset-4 hover:underline">
          反馈建议
        </Link>
      </p>
    </footer>
  );
}

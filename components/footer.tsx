import Image from "next/image";
import Link from "next/link";
import { PwaInstallButton } from "@/components/pwa/pwa-install-button";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <p className="flex flex-wrap items-center justify-center gap-2">
        <Image
          src="/brand/muhub_logo_mark.png"
          alt=""
          width={80}
          height={88}
          className="h-7 w-auto opacity-85 dark:opacity-90"
        />
        <span className="text-zinc-400 dark:text-zinc-600" aria-hidden>
          ·
        </span>
        <span>© 木哈布 MUHUB</span>
        <span className="mx-2 text-zinc-300 dark:text-zinc-600">·</span>
        <Link href="/feedback" className="underline-offset-4 hover:underline">
          反馈与建议
        </Link>
      </p>
      <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/terms" className="underline-offset-4 hover:underline">
          用户协议
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
          |
        </span>
        <Link href="/legal" className="underline-offset-4 hover:underline">
          法律声明
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
          |
        </span>
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          隐私政策
        </Link>
      </p>
      <PwaInstallButton />
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          京ICP备2026011107号-1
        </a>
        <span className="mx-2 text-zinc-300 dark:text-zinc-600">|</span>
        <a
          href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=11010802048031"
          target="_blank"
          rel="noreferrer"
          className="underline-offset-4 hover:underline"
        >
          京公网安备11010802048031号
        </a>
      </p>
    </footer>
  );
}

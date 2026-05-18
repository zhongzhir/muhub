import type { Metadata } from "next";
import Link from "next/link";
import { HelpPageShell } from "@/components/help/help-page-shell";
import { SITE_NAME_EN, SITE_NAME_ZH } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "网站帮助",
  description: `了解 ${SITE_NAME_ZH} ${SITE_NAME_EN}、开放项目、项目页面与互动方式，帮助普通用户更好使用平台。`,
};

const TOPICS = [
  {
    href: "/help/open-projects",
    title: "开放项目入门",
    description:
      "写给没有技术背景用户的 GitHub / GitCode / Gitee 使用指南：看懂项目页、下载安装与安全使用。",
  },
] as const;

export default function HelpIndexPage() {
  return (
    <HelpPageShell
      title="网站帮助"
      description="帮助普通用户理解 MUHUB、开放项目、项目页面、互动与使用方式。"
    >
      <section aria-labelledby="help-topics-heading">
        <h2 id="help-topics-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          专题指南
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-1">
          {TOPICS.map((topic) => (
            <li key={topic.href}>
              <Link
                href={topic.href}
                className="muhub-card muhub-card--interactive flex h-full flex-col p-5 transition hover:border-zinc-300 dark:hover:border-zinc-600"
              >
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{topic.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {topic.description}
                </p>
                <span className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400">阅读指南 →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </HelpPageShell>
  );
}

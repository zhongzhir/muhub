import type { Metadata } from "next";
import { HelpPageShell } from "@/components/help/help-page-shell";
import { OpenProjectsGuide } from "@/components/help/open-projects-guide";
import { OPEN_PROJECTS_META } from "@/lib/help/open-projects";
import { SITE_NAME_EN, SITE_NAME_ZH } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: OPEN_PROJECTS_META.title,
  description: `${OPEN_PROJECTS_META.subtitle} · ${SITE_NAME_ZH} ${SITE_NAME_EN} 网站帮助`,
};

export default function OpenProjectsHelpPage() {
  return (
    <HelpPageShell title={OPEN_PROJECTS_META.title} description={OPEN_PROJECTS_META.intro}>
      <p className="-mt-4 mb-8 text-sm text-zinc-500 dark:text-zinc-400">{OPEN_PROJECTS_META.subtitle}</p>
      <OpenProjectsGuide />
    </HelpPageShell>
  );
}

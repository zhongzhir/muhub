import Link from "next/link";
import Hero from "@/components/home/hero";
import BetaNotice from "@/components/home/beta-notice";
import RecommendedProjects from "@/components/home/recommended";
import GeoFaq from "@/components/home/geo-faq";
import GeoSeoFootnote from "@/components/home/geo-seo-footnote";
import { BetaTrustStrip } from "@/components/home/beta-trust-strip";
import { readSiteContentLatestFirst } from "@/agents/growth/site-content-store";
import { ContentList } from "@/components/content/content-list";

export default async function HomePage() {
  const siteItems = await readSiteContentLatestFirst();
  const latestSite = siteItems.slice(0, 5);

  return (
    <main className="min-h-screen">
      <Hero />
      <BetaNotice />
      {latestSite.length > 0 ? (
        <section className="border-t border-zinc-200/80 py-14 dark:border-zinc-800">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Latest from MUHUB
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  最近站内发布的内容动态（最多 5 条）
                </p>
              </div>
              <Link
                href="/content"
                className="text-sm font-medium text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
              >
                查看全部
              </Link>
            </div>
            <div className="mt-8">
              <ContentList items={latestSite} />
            </div>
          </div>
        </section>
      ) : null}
      <RecommendedProjects />
      <GeoFaq />
      <div className="mx-auto max-w-4xl px-6 pb-8 sm:px-8">
        <BetaTrustStrip />
      </div>
      <GeoSeoFootnote />
    </main>
  );
}

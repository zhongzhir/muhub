import Hero from "@/components/home/hero";
import BetaNotice from "@/components/home/beta-notice";
import RecommendedProjects from "@/components/home/recommended";
import GeoPlatformIntro from "@/components/home/geo-platform-intro";
import Features from "@/components/home/features";
import GeoFaq from "@/components/home/geo-faq";
import GeoSeoFootnote from "@/components/home/geo-seo-footnote";
import { BetaTrustStrip } from "@/components/home/beta-trust-strip";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <BetaNotice />
      <RecommendedProjects />
      <GeoPlatformIntro />
      <Features />
      <GeoFaq />
      <div className="mx-auto max-w-4xl px-6 pb-8 sm:px-8">
        <BetaTrustStrip />
      </div>
      <GeoSeoFootnote />
    </main>
  );
}

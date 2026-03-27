import Hero from "@/components/home/hero";
import BetaNotice from "@/components/home/beta-notice";
import AIImport from "@/components/home/ai-import";
import RecommendedProjects from "@/components/home/recommended";
import GeoPlatformIntro from "@/components/home/geo-platform-intro";
import Features from "@/components/home/features";
import GeoFaq from "@/components/home/geo-faq";
import GeoSeoFootnote from "@/components/home/geo-seo-footnote";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <BetaNotice />
      <AIImport />
      <RecommendedProjects />
      <GeoPlatformIntro />
      <Features />
      <GeoFaq />
      <GeoSeoFootnote />
    </main>
  );
}

import Hero from "@/components/home/hero";
import BetaNotice from "@/components/home/beta-notice";
import AIImport from "@/components/home/ai-import";
import RecommendedProjects from "@/components/home/recommended";
import Features from "@/components/home/features";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <BetaNotice />
      <AIImport />
      <RecommendedProjects />
      <Features />
    </main>
  );
}

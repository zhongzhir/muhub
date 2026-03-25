import Hero from "@/components/home/hero";
import AIImport from "@/components/home/ai-import";
import RecommendedProjects from "@/components/home/recommended";
import Features from "@/components/home/features";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Hero />
      <AIImport />
      <RecommendedProjects />
      <Features />
    </main>
  );
}

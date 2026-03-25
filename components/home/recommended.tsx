import Link from "next/link";

export default function RecommendedProjects() {
  return (
    <section className="border-t py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-semibold">推荐项目</h2>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Link href="/projects/langchain" className="rounded-lg border p-4 hover:shadow-sm">
            <h3 className="font-semibold">LangChain</h3>
            <p className="text-sm text-gray-500">LLM 应用开发框架</p>
          </Link>

          <Link href="/projects/pytorch" className="rounded-lg border p-4 hover:shadow-sm">
            <h3 className="font-semibold">PyTorch</h3>
            <p className="text-sm text-gray-500">深度学习框架</p>
          </Link>

          <Link href="/projects/nextjs" className="rounded-lg border p-4 hover:shadow-sm">
            <h3 className="font-semibold">Next.js</h3>
            <p className="text-sm text-gray-500">React 全栈框架</p>
          </Link>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

export default function RecommendedProjects() {
  return (
    <section className="border-t border-zinc-200/80 py-16 dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          看看这些项目在木哈布上的样子
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-zinc-600 dark:text-zinc-400">
          以下为冷启动示例，点击可体验详情与分享名片（未写入你的数据库时仅以只读演示呈现）。
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link
            href="/projects/langchain"
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">LangChain</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">LLM 应用与 Agent 框架</p>
          </Link>

          <Link
            href="/projects/pytorch"
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">PyTorch</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">深度学习研究与生产</p>
          </Link>

          <Link
            href="/projects/nextjs"
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
          >
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Next.js</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">React 全栈与部署</p>
          </Link>
        </div>
      </div>
    </section>
  );
}

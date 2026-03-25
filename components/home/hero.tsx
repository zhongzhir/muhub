import Link from "next/link";

export default function Hero() {
  return (
    <section className="py-24 text-center">
      <h1 className="text-5xl font-bold tracking-tight">MUHUB</h1>

      <p className="mt-6 text-lg text-gray-600">AI Native 项目展示与动态聚合平台</p>

      <p className="mt-2 text-sm text-gray-500">统一展示你的项目，方便介绍与融资</p>

      <div className="mt-8 flex justify-center gap-4">
        <Link href="/projects" className="rounded-lg bg-black px-6 py-3 text-white">
          浏览项目
        </Link>

        <Link href="/dashboard/projects/new" className="rounded-lg border px-6 py-3">
          创建项目
        </Link>
      </div>
    </section>
  );
}

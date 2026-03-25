export default function Features() {
  return (
    <section className="border-t py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-2xl font-semibold">核心能力</h2>

        <div className="mt-10 grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <h3 className="font-semibold">项目名片</h3>
            <p className="mt-2 text-sm text-gray-500">统一展示项目介绍与信息</p>
          </div>

          <div className="text-center">
            <h3 className="font-semibold">动态聚合</h3>
            <p className="mt-2 text-sm text-gray-500">自动更新项目动态</p>
          </div>

          <div className="text-center">
            <h3 className="font-semibold">AI Native</h3>
            <p className="mt-2 text-sm text-gray-500">AI 自动生成项目页</p>
          </div>
        </div>
      </div>
    </section>
  );
}

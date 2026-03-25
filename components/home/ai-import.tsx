/**
 * 服务端组件：使用原生 GET 表单跳转，避免 client 内动态 <a href> 触发 Layout Router 异常。
 */
export default function AIImport() {
  return (
    <section className="border-t py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-semibold">导入 GitHub / Gitee 项目</h2>

        <p className="mt-2 text-sm text-gray-500">输入仓库地址，自动生成项目展示页</p>

        <form
          action="/dashboard/projects/new"
          method="get"
          className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:gap-2"
        >
          <input
            name="import"
            type="text"
            inputMode="url"
            className="w-full rounded-lg border px-4 py-2 sm:min-w-0 sm:flex-1"
            placeholder="https://github.com/..."
            aria-label="仓库地址"
            autoComplete="off"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-lg bg-black px-4 py-2 text-white sm:shrink-0"
          >
            生成项目
          </button>
        </form>
      </div>
    </section>
  );
}

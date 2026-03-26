import Link from "next/link";

/**
 * 服务端组件：使用原生 GET 表单跳转，避免 client 内动态 <a href> 触发 Layout Router 异常。
 */
export default function AIImport() {
  return (
    <section className="border-t border-zinc-200/80 py-16 dark:border-zinc-800">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          粘贴仓库链接，快速预填项目
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          支持 <strong className="font-medium text-zinc-800 dark:text-zinc-200">GitHub</strong> 与{" "}
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">Gitee</strong>。下方将跳转至
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">创建页</strong>
          并预填仓库地址；需要服务端拉取 GitHub 元数据时请用{" "}
          <Link href="/dashboard/projects/import" className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">
            GitHub 导入
          </Link>
          （仅 GitHub.com）。
        </p>

        <form
          action="/dashboard/projects/new"
          method="get"
          className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center sm:gap-2"
        >
          <input type="hidden" name="creationSource" value="import" />
          <input
            name="import"
            type="text"
            inputMode="url"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-900 sm:min-w-0 sm:flex-1"
            placeholder="https://github.com/owner/repo 或 Gitee 仓库地址"
            aria-label="仓库地址"
            autoComplete="off"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:shrink-0"
          >
            预填并创建
          </button>
        </form>
        <p className="mt-3 text-xs text-zinc-500">
          提交后请在创建页补全 slug 与介绍；导入页可一键读取 GitHub API 写入名称与描述。
        </p>
      </div>
    </section>
  );
}

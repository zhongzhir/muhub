import Link from "next/link";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:focus:border-zinc-400";

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-xl px-6 py-12">
        <p className="mb-6 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
        </p>
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">创建项目</h1>
        <form className="space-y-6" action="#" method="get">
          <fieldset className="space-y-4">
            <label className="block text-sm font-medium">
              项目名称
              <input className={inputClass} name="name" type="text" placeholder="例如：MUHUB" />
            </label>
            <label className="block text-sm font-medium">
              slug
              <input className={inputClass} name="slug" type="text" placeholder="url 友好标识，如 muhub" />
            </label>
            <label className="block text-sm font-medium">
              GitHub URL
              <input className={inputClass} name="githubUrl" type="url" placeholder="https://github.com/org/repo" />
            </label>
            <label className="block text-sm font-medium">
              官网 URL
              <input className={inputClass} name="websiteUrl" type="url" placeholder="https://..." />
            </label>
            <label className="block text-sm font-medium">
              微博
              <input className={inputClass} name="weibo" type="text" placeholder="账号或链接" />
            </label>
            <label className="block text-sm font-medium">
              公众号
              <input className={inputClass} name="wechat" type="text" placeholder="公众号名称" />
            </label>
            <label className="block text-sm font-medium">
              抖音
              <input className={inputClass} name="douyin" type="text" placeholder="抖音号" />
            </label>
            <label className="block text-sm font-medium">
              小红书
              <input className={inputClass} name="xiaohongshu" type="text" placeholder="小红书号" />
            </label>
          </fieldset>
          <p className="text-xs text-zinc-500">
            当前为静态表单占位；后续可接入 API 与 Prisma 写入。
          </p>
        </form>
      </div>
    </div>
  );
}

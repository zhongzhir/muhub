import Link from "next/link";
import { ImportGitHubForm } from "./import-github-form";

export default function ImportGitHubProjectPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-xl px-6 py-12">
        <p className="mb-6 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/" className="underline-offset-4 hover:underline">
            返回首页
          </Link>
          <Link href="/dashboard/projects/new" className="underline-offset-4 hover:underline">
            创建项目
          </Link>
        </p>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">从 GitHub 导入项目</h1>
        <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
          输入仓库地址后，将从 GitHub 读取基本信息并跳转到创建页预填；你仍需填写{" "}
          <strong>slug</strong>、中文介绍与社媒等字段后再提交。
        </p>
        <ImportGitHubForm />
      </div>
    </div>
  );
}

import Link from "next/link";

import { MobileCaptureForm } from "./mobile-capture-form";

export const dynamic = "force-dynamic";

export default function AdminDiscoveryMobilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/admin/discovery/items" className="underline-offset-4 hover:underline">
          返回 Discovery Items
        </Link>
      </p>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          手机采集箱
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          用于快速保存手机端看到的公众号文章、网页链接或正文。提交后会进入 Discovery
          Items，可继续执行项目提取和入队流程。
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <MobileCaptureForm />
      </section>
    </div>
  );
}

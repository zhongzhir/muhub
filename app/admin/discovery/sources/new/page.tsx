import Link from "next/link";
import { DiscoverySourceForm } from "../source-form";

export const dynamic = "force-dynamic";

export default function AdminDiscoverySourceNewPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-zinc-500">
        <Link href="/admin/discovery/sources" className="underline">
          ← 来源网络
        </Link>
      </p>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">新增 publishing_ai 信息源</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          人工维护信息源网络，不人工维护项目库。新建后建议 TESTING → 手动运行 → 查看 Yield → ACTIVE。
        </p>
      </header>
      <DiscoverySourceForm mode="create" />
    </div>
  );
}

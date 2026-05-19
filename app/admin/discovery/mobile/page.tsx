import Link from "next/link";

import { readDiscoveryItems } from "@/agents/discovery/discovery-store";
import { ManualCopyTextarea } from "@/components/share/manual-copy-textarea";
import { isSourceMaterialDiscoveryItem } from "@/lib/discovery/mobile-capture";
import { MobileAutoExtractButton } from "./mobile-auto-extract-button";
import { MobileCaptureForm } from "./mobile-capture-form";

export const dynamic = "force-dynamic";

function stringMeta(meta: Record<string, unknown> | undefined, key: string): string {
  const value = meta?.[key];
  return typeof value === "string" ? value : "";
}

function boolMeta(meta: Record<string, unknown> | undefined, key: string): boolean {
  return meta?.[key] === true;
}

function numberMeta(meta: Record<string, unknown> | undefined, key: string): number | null {
  const value = meta?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function queuedMeta(
  meta: Record<string, unknown> | undefined,
): { success: number; duplicate: number; failed: number } | null {
  const value = meta?.autoExtractionQueued;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  return {
    success: typeof row.success === "number" ? row.success : 0,
    duplicate: typeof row.duplicate === "number" ? row.duplicate : 0,
    failed: typeof row.failed === "number" ? row.failed : 0,
  };
}

function extractionLabel(meta: Record<string, unknown> | undefined): string {
  const status = stringMeta(meta, "autoExtractionStatus");
  if (status === "done") {
    const total = numberMeta(meta, "autoExtractionTotal") ?? 0;
    const queued = queuedMeta(meta);
    return queued
      ? `自动提取完成：识别 ${total} 个，新增 ${queued.success} 个，重复 ${queued.duplicate} 个，失败 ${queued.failed} 个`
      : `自动提取完成：识别 ${total} 个`;
  }
  if (status === "failed") {
    const error = stringMeta(meta, "autoExtractionError");
    return `自动提取失败${error ? `：${error}` : ""}`;
  }
  if (status === "skipped") {
    const reason = stringMeta(meta, "autoExtractionReason");
    if (reason === "no_url") return "未检测到链接，需人工提取";
    if (reason === "duplicate") return "重复素材，已跳过自动提取";
    return "已跳过自动提取";
  }
  return boolMeta(meta, "needsExtraction") ? "待提取" : "已处理";
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
}

export default async function AdminDiscoveryMobilePage() {
  const recentItems = (await readDiscoveryItems())
    .filter(isSourceMaterialDiscoveryItem)
    .slice(0, 12);

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

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">最近待提取素材</h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              手机采集箱只保存原始文章链接/正文；提取出真实项目后，项目候选才进入待筛选列表。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/discovery/items" className="rounded border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700">
              JSON 队列
            </Link>
            <Link href="/admin/discovery?material=source_material" className="rounded border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700">
              素材筛选
            </Link>
          </div>
        </div>

        {recentItems.length ? (
          <div className="mt-4 space-y-3">
            {recentItems.map((item) => {
              const extractedUrl = stringMeta(item.meta, "extractedUrl") || item.url;
              const sourceNote = stringMeta(item.meta, "sourceNote");
              const articleBody = stringMeta(item.meta, "articleBody") || item.description || item.url;
              const isWechatArticle = boolMeta(item.meta, "isWechatArticle");
              const extractionStatus = extractionLabel(item.meta);
              return (
                <article key={item.id} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words font-medium text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                      <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">{extractedUrl}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {sourceNote ? `来源备注：${sourceNote} · ` : ""}
                        {isWechatArticle ? "微信文章 · " : ""}
                        {formatTime(item.createdAt)} · {extractionStatus}
                      </p>
                      {(() => {
                        const dups = item.meta?.autoExtractionDuplicates;
                        if (!Array.isArray(dups) || dups.length === 0) return null;
                        return (
                          <div className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-300">
                            {dups.slice(0, 3).map((dup) => {
                              if (!dup || typeof dup !== "object") return null;
                              const row = dup as Record<string, unknown>;
                              const projectName =
                                typeof row.projectName === "string" ? row.projectName : "";
                              const slug = typeof row.slug === "string" ? row.slug : "";
                              return (
                                <p key={`${slug}-${projectName}`}>
                                  重复：{projectName}
                                  {slug ? ` (/projects/${slug})` : ""}
                                </p>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {extractedUrl.startsWith("http") ? (
                        <a
                          href={extractedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
                        >
                          打开链接
                        </a>
                      ) : null}
                      <MobileAutoExtractButton itemId={item.id} />
                    </div>
                  </div>
                  <ManualCopyTextarea value={articleBody} hint="复制内容后可到 JSON 队列的“批量提取项目”中粘贴正文" />
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-3 text-sm text-zinc-500 dark:bg-zinc-950/40 dark:text-zinc-400">
            暂无手机采集素材。
          </p>
        )}
      </section>
    </div>
  );
}

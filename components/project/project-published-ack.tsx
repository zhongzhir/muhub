"use client";

import { useEffect, useState } from "react";

/**
 * 发布动态成功后由 URL ?published=1 触发；展示轻量反馈并从地址栏移除查询参数（保留 hash）。
 */
export function ProjectPublishedAck({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get("published") === "1") {
      url.searchParams.delete("published");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, [show]);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      className="mt-6 flex flex-col gap-3 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-4 text-emerald-950 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100 sm:flex-row sm:items-center sm:justify-between"
      data-testid="project-published-ack"
    >
      <p className="text-sm font-medium">动态已发布成功。下方「最新动态」中可查看刚发布的内容。</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100 dark:hover:bg-emerald-900"
      >
        知道了
      </button>
    </div>
  );
}

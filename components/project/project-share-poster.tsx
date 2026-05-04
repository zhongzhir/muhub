"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";
import html2canvas from "html2canvas";
import { QRCodeCanvas } from "qrcode.react";

export type ProjectSharePosterProps = {
  slug: string;
  name: string;
  intro: string;
  summary?: string;
  highlights?: string[];
  latestActivity?: {
    type:
      | "project_imported"
      | "project_profile_updated"
      | "github_repo_updated"
      | "github_release_detected"
      | "official_update_detected";
    title: string;
    occurredAt: string;
    summary?: string;
  } | null;
  projectPageUrl: string;
  githubUrl?: string | null;
  gitccUrl?: string | null;
  websiteUrl?: string | null;
  tags?: string[];
  category?: string | null;
};

const POSTER_WIDTH = 520;

const actionBtnClass =
  "inline-flex max-w-full shrink-0 items-baseline gap-1 rounded-md px-1 py-0.5 text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";

function formatPosterDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("zh-CN");
  } catch {
    return value.slice(0, 10);
  }
}

// 海报内部仅使用十六进制颜色 + 内联样式，避免 TailwindCSS v4 的 oklch() 颜色
// 让 html2canvas 解析失败导致下载报错。
const posterStyles = {
  root: {
    width: POSTER_WIDTH,
    boxSizing: "border-box",
    background: "#ffffff",
    color: "#18181b",
    padding: 32,
    fontFamily:
      "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    textAlign: "left",
  } satisfies CSSProperties,
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  } satisfies CSSProperties,
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } satisfies CSSProperties,
  logo: {
    width: 36,
    height: 36,
    flex: "0 0 36px",
    borderRadius: 12,
    background: "#18181b",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0,
  } satisfies CSSProperties,
  brandName: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.02em",
    color: "#18181b",
    margin: 0,
  } satisfies CSSProperties,
  brandSubtitle: {
    fontSize: 11,
    color: "#71717a",
    margin: "2px 0 0",
  } satisfies CSSProperties,
  pill: {
    borderRadius: 999,
    border: "1px solid #e4e4e7",
    padding: "4px 12px",
    fontSize: 11,
    fontWeight: 500,
    color: "#52525b",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  title: {
    marginTop: 32,
    fontSize: 36,
    fontWeight: 800,
    lineHeight: 1.15,
    color: "#0a0a0a",
    wordBreak: "break-word",
  } satisfies CSSProperties,
  intro: {
    marginTop: 16,
    fontSize: 16,
    lineHeight: 1.6,
    color: "#3f3f46",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  } satisfies CSSProperties,
  chipRow: {
    marginTop: 20,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  } satisfies CSSProperties,
  chip: {
    borderRadius: 999,
    border: "1px solid #d4d4d8",
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 500,
    color: "#3f3f46",
  } satisfies CSSProperties,
  useCaseBox: {
    marginTop: 24,
    background: "#f4f4f5",
    borderRadius: 12,
    padding: 16,
  } satisfies CSSProperties,
  useCaseLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#71717a",
    margin: 0,
  } satisfies CSSProperties,
  useCaseList: {
    marginTop: 8,
    paddingLeft: 0,
    listStyle: "none",
    color: "#3f3f46",
    fontSize: 14,
    lineHeight: 1.6,
  } satisfies CSSProperties,
  activityBox: {
    marginTop: 20,
    border: "1px solid #e4e4e7",
    borderRadius: 12,
    padding: 16,
    background: "#ffffff",
  } satisfies CSSProperties,
  activityLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#71717a",
    margin: 0,
  } satisfies CSSProperties,
  activityTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: 600,
    color: "#27272a",
  } satisfies CSSProperties,
  activitySummary: {
    marginTop: 4,
    fontSize: 12,
    color: "#52525b",
    lineHeight: 1.5,
  } satisfies CSSProperties,
  activityDate: {
    marginTop: 4,
    fontSize: 11,
    color: "#71717a",
  } satisfies CSSProperties,
  linksWrap: {
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid #e4e4e7",
    fontSize: 14,
    color: "#27272a",
  } satisfies CSSProperties,
  linkLine: {
    marginTop: 8,
    wordBreak: "break-all",
  } satisfies CSSProperties,
  linkLabel: {
    fontWeight: 600,
    color: "#27272a",
    marginRight: 4,
  } satisfies CSSProperties,
  linkValue: {
    color: "#1d4ed8",
  } satisfies CSSProperties,
  footerRow: {
    marginTop: 32,
    paddingTop: 24,
    borderTop: "1px solid #e4e4e7",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
  } satisfies CSSProperties,
  footerInfo: {
    minWidth: 0,
    flex: 1,
  } satisfies CSSProperties,
  footerUrl: {
    fontSize: 11,
    lineHeight: 1.4,
    color: "#71717a",
    wordBreak: "break-all",
    margin: 0,
  } satisfies CSSProperties,
  footerSlogan: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: 600,
    color: "#27272a",
  } satisfies CSSProperties,
  qrWrap: {
    flex: "0 0 auto",
    border: "1px solid #e4e4e7",
    borderRadius: 8,
    background: "#ffffff",
    padding: 8,
    textAlign: "center",
  } satisfies CSSProperties,
  qrCaption: {
    marginTop: 4,
    fontSize: 10,
    color: "#71717a",
  } satisfies CSSProperties,
};

export function ProjectSharePoster({
  slug,
  name,
  intro,
  summary,
  highlights,
  latestActivity,
  projectPageUrl,
  githubUrl,
  gitccUrl,
  websiteUrl,
  tags,
  category,
}: ProjectSharePosterProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const posterRef = useRef<HTMLDivElement>(null);

  const downloadPng = useCallback(async () => {
    const el = posterRef.current;
    if (!el) {
      setError("海报尚未生成，请稍后再试。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const canvas = await html2canvas(el, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        // 强制使用海报实际尺寸，避免外层 transform: scale() 对捕获的影响。
        width: el.offsetWidth,
        height: el.offsetHeight,
        windowWidth: el.offsetWidth,
        windowHeight: el.offsetHeight,
      });
      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl || dataUrl === "data:,") {
        throw new Error("生成的图像数据为空");
      }
      const link = document.createElement("a");
      link.download = `muhub-${slug}-poster.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("[ProjectSharePoster] download failed", e);
      const message = e instanceof Error ? e.message : String(e);
      setError(`下载失败：${message || "未知错误"}`);
    } finally {
      setBusy(false);
    }
  }, [slug]);

  const gh = githubUrl?.trim() || "";
  const gitcc = gitccUrl?.trim() || "";
  const web = websiteUrl?.trim() || "";
  const introText = summary?.trim() || intro.trim() || "在 MUHUB 查看项目主页与最新动态。";
  const chips = [category, ...(tags ?? []), ...(highlights ?? [])]
    .filter((item): item is string => Boolean(item?.trim()))
    .slice(0, 4);
  const useCases = (highlights ?? []).slice(0, 3);

  return (
    <>
      <button type="button" className={actionBtnClass} onClick={() => setOpen(true)}>
        海报
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="poster-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="poster-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              海报
            </h2>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              预览下方海报，可下载 PNG 后自行分享。
            </p>

            <div className="mt-4 flex justify-center overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="origin-top scale-[0.72] sm:scale-[0.85]">
                <div ref={posterRef} style={posterStyles.root}>
                  <div style={posterStyles.headerRow}>
                    <div style={posterStyles.brandRow}>
                      <div style={posterStyles.logo} aria-hidden>
                        M
                      </div>
                      <div>
                        <p style={posterStyles.brandName}>MUHUB</p>
                        <p style={posterStyles.brandSubtitle}>项目档案</p>
                      </div>
                    </div>
                    <span style={posterStyles.pill}>发现好项目</span>
                  </div>

                  <h3 style={posterStyles.title}>{name}</h3>
                  <p style={posterStyles.intro}>{introText}</p>

                  {chips.length > 0 ? (
                    <div style={posterStyles.chipRow}>
                      {chips.map((h) => (
                        <span key={h} style={posterStyles.chip}>
                          {h.startsWith("#") ? h : `#${h}`}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {useCases.length > 0 ? (
                    <div style={posterStyles.useCaseBox}>
                      <p style={posterStyles.useCaseLabel}>适合谁 / 使用场景</p>
                      <ul style={posterStyles.useCaseList}>
                        {useCases.map((item) => (
                          <li key={item} style={{ marginTop: 6 }}>
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {latestActivity ? (
                    <div style={posterStyles.activityBox}>
                      <p style={posterStyles.activityLabel}>最新动态</p>
                      <p style={posterStyles.activityTitle}>{latestActivity.title}</p>
                      {latestActivity.summary ? (
                        <p style={posterStyles.activitySummary}>{latestActivity.summary}</p>
                      ) : null}
                      <p style={posterStyles.activityDate}>{formatPosterDate(latestActivity.occurredAt)}</p>
                    </div>
                  ) : null}

                  {(web || gh || gitcc) ? (
                    <div style={posterStyles.linksWrap}>
                      {web ? (
                        <p style={posterStyles.linkLine}>
                          <span style={posterStyles.linkLabel}>官网</span>
                          <span style={posterStyles.linkValue}>{web}</span>
                        </p>
                      ) : null}
                      {gh ? (
                        <p style={posterStyles.linkLine}>
                          <span style={posterStyles.linkLabel}>GitHub</span>
                          <span style={posterStyles.linkValue}>{gh}</span>
                        </p>
                      ) : null}
                      {gitcc ? (
                        <p style={posterStyles.linkLine}>
                          <span style={posterStyles.linkLabel}>GitCC</span>
                          <span style={posterStyles.linkValue}>{gitcc}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={posterStyles.footerRow}>
                    <div style={posterStyles.footerInfo}>
                      <p style={posterStyles.footerUrl}>{projectPageUrl}</p>
                      <p style={posterStyles.footerSlogan}>发现好项目，上 MUHUB</p>
                    </div>
                    <div style={posterStyles.qrWrap}>
                      <QRCodeCanvas value={projectPageUrl} size={104} level="M" includeMargin={false} />
                      <span style={posterStyles.qrCaption}>扫码访问</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                onClick={() => void downloadPng()}
                data-testid="project-poster-download"
              >
                {busy ? "生成中…" : "下载海报"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

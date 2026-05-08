"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// ─── 尺寸与字体 ───────────────────────────────────────────────────────────────
const POSTER_WIDTH = 720;
const POSTER_PADDING = 48;
const QR_SIZE = 140;
const FONT_FAMILY =
  "system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";

// ─── 颜色系统 ─────────────────────────────────────────────────────────────────
// Header（深色）
const HDR_BG_TOP = "#09090b";    // zinc-950
const HDR_BG_BOT = "#18181b";    // zinc-900
const HDR_FG = "#ffffff";
const HDR_MUTED = "#71717a";     // zinc-500
const HDR_SUB = "#a1a1aa";       // zinc-400
// 品牌色
const ACCENT_A = "#14b8a6";      // teal-500
const ACCENT_B = "#0891b2";      // cyan-600
const ACCENT_C = "#6366f1";      // indigo-500
// 内容区（浅色）
const CONTENT_BG = "#ffffff";
const CONTENT_FG = "#18181b";    // zinc-900
const CONTENT_SUB = "#52525b";   // zinc-600
const CONTENT_MUTED = "#71717a"; // zinc-500
const CONTENT_BORDER = "#e4e4e7";
const CONTENT_BG_ALT = "#f4f4f5";
const CONTENT_LINK = "#1d4ed8";
// Footer
const FOOTER_BG = "#f4f4f5";

const SLOGAN = "看见好项目，上 MUHUB";

const ghostBtnClass =
  "inline-flex max-w-full shrink-0 items-baseline gap-1 rounded-md px-1 py-0.5 text-sm text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200";

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function formatPosterDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
  } catch {
    return value.slice(0, 10);
  }
}

function safeText(value: string | null | undefined): string {
  return (value ?? "").replace(/[ --]/g, "").trim();
}

function compactUrl(value: string, maxChars = 60): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxChars) return trimmed;
  try {
    const u = new URL(trimmed);
    const tail = u.pathname.length > 18 ? `…${u.pathname.slice(-15)}` : u.pathname;
    return `${u.host}${tail}`;
  } catch {
    return `${trimmed.slice(0, maxChars - 1)}…`;
  }
}

/** 按可视宽度切分文本，最多 maxLines 行，超出末行加省略号 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  if (!text) return lines;
  const paragraphs = text.split(/\n+/);
  for (const paragraph of paragraphs) {
    let current = "";
    for (let i = 0; i < paragraph.length; i++) {
      const ch = paragraph[i];
      const candidate = current + ch;
      if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
        lines.push(current);
        if (lines.length >= maxLines) break;
        current = ch;
      } else {
        current = candidate;
      }
    }
    if (lines.length >= maxLines) break;
    if (current) lines.push(current);
  }
  if (lines.length > maxLines) {
    const truncated = lines.slice(0, maxLines);
    const last = truncated[truncated.length - 1];
    let withEllipsis = `${last}…`;
    while (withEllipsis.length > 1 && ctx.measureText(withEllipsis).width > maxWidth) {
      withEllipsis = `${withEllipsis.slice(0, -2)}…`;
    }
    truncated[truncated.length - 1] = withEllipsis;
    return truncated;
  }
  return lines;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── 内容准备 ─────────────────────────────────────────────────────────────────

type PosterContent = {
  name: string;
  intro: string;
  chips: string[];
  useCases: string[];
  latestActivity: ProjectSharePosterProps["latestActivity"];
  links: { label: string; value: string }[];
  projectPageUrl: string;
};

function preparePoster(props: ProjectSharePosterProps): PosterContent {
  const introText =
    safeText(props.summary) || safeText(props.intro) || "在 MUHUB 查看项目主页与最新动态。";
  const chips = [props.category, ...(props.tags ?? [])]
    .map((item) => safeText(item))
    .filter((item) => item.length > 0)
    .slice(0, 4);
  const useCases = (props.highlights ?? [])
    .map((item) => safeText(item))
    .filter((item) => item.length > 0)
    .slice(0, 3);
  const links: { label: string; value: string }[] = [];
  const web = safeText(props.websiteUrl);
  const gh = safeText(props.githubUrl);
  const gitcc = safeText(props.gitccUrl);
  if (web) links.push({ label: "官网", value: compactUrl(web) });
  if (gh) links.push({ label: "GitHub", value: compactUrl(gh) });
  if (gitcc) links.push({ label: "GitCC", value: compactUrl(gitcc) });
  return {
    name: safeText(props.name) || "MUHUB 项目",
    intro: introText,
    chips,
    useCases,
    latestActivity: props.latestActivity ?? null,
    links: links.slice(0, 2),
    projectPageUrl: props.projectPageUrl,
  };
}

// ─── Canvas 渲染 ──────────────────────────────────────────────────────────────

function renderPosterToCanvas(
  content: PosterContent,
  qrSource: HTMLCanvasElement | null,
): HTMLCanvasElement {
  const mc = document.createElement("canvas");
  const mctx = mc.getContext("2d");
  if (!mctx) throw new Error("当前浏览器不支持 Canvas 2D。");

  const CL = POSTER_PADDING;         // content left
  const CR = POSTER_WIDTH - POSTER_PADDING; // content right
  const CW = CR - CL;                // content width

  // ── 测量 Header 高度 ──────────────────────────────────────────────────
  const HDR_TOP = 36;
  const BRAND_H = 34;     // logo block height
  const BRAND_GAP = 22;   // gap from brand to title
  const TITLE_LINE_H = 52;
  const TITLE_GAP = 14;
  const INTRO_LINE_H = 27;
  const CHIPS_GAP = 12;
  const CHIPS_H = 30;
  const HDR_BOT = 42;

  mctx.font = `800 42px ${FONT_FAMILY}`;
  const titleLines = wrapText(mctx, content.name, CW, 2);

  mctx.font = `400 17px ${FONT_FAMILY}`;
  const introLines = wrapText(mctx, content.intro, CW, 3);

  const hasChips = content.chips.length > 0;
  const headerHeight =
    HDR_TOP +
    BRAND_H +
    BRAND_GAP +
    titleLines.length * TITLE_LINE_H +
    TITLE_GAP +
    introLines.length * INTRO_LINE_H +
    (hasChips ? CHIPS_GAP + CHIPS_H : 0) +
    HDR_BOT;

  // ── 测量内容区高度 ────────────────────────────────────────────────────
  const ACCENT_H = 4;
  const CONTENT_TOP_PAD = POSTER_PADDING;
  let contentHeight = CONTENT_TOP_PAD;

  // Use cases
  let useCaseBoxH = 0;
  const wrappedUseCases: string[][] = [];
  if (content.useCases.length) {
    mctx.font = `400 15px ${FONT_FAMILY}`;
    let bodyLines = 0;
    for (const item of content.useCases) {
      const ll = wrapText(mctx, `· ${item}`, CW - 32, 2);
      wrappedUseCases.push(ll);
      bodyLines += ll.length;
    }
    useCaseBoxH = 16 + 14 + 10 + bodyLines * 22 + 16;
    contentHeight += useCaseBoxH + 20;
  }

  // Activity
  let activityBoxH = 0;
  let actTitleLines: string[] = [];
  let actSumLines: string[] = [];
  if (content.latestActivity) {
    mctx.font = `600 15px ${FONT_FAMILY}`;
    actTitleLines = wrapText(mctx, content.latestActivity.title, CW - 32, 2);
    mctx.font = `400 13px ${FONT_FAMILY}`;
    actSumLines = content.latestActivity.summary
      ? wrapText(mctx, content.latestActivity.summary, CW - 32, 2)
      : [];
    activityBoxH =
      16 + 14 + 8 +
      actTitleLines.length * 22 +
      (actSumLines.length ? 8 + actSumLines.length * 20 : 0) +
      8 + 16 + 14;
    contentHeight += activityBoxH + 20;
  }

  // Links
  let linksH = 0;
  if (content.links.length) {
    linksH = 1 + 16 + content.links.length * 26 + 8;
    contentHeight += linksH;
  }

  contentHeight += POSTER_PADDING; // bottom pad of content

  // Footer
  const FOOTER_H = POSTER_PADDING + QR_SIZE + 16 + POSTER_PADDING;

  const totalHeight = headerHeight + ACCENT_H + contentHeight + FOOTER_H;

  // ── Canvas 初始化 ─────────────────────────────────────────────────────
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_WIDTH * dpr;
  canvas.height = totalHeight * dpr;
  canvas.style.width = `${POSTER_WIDTH}px`;
  canvas.style.height = `${totalHeight}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持 Canvas 2D。");
  ctx.scale(dpr, dpr);

  // ── 绘制 Header 背景 ──────────────────────────────────────────────────
  const hdrGrad = ctx.createLinearGradient(0, 0, POSTER_WIDTH * 0.7, headerHeight);
  hdrGrad.addColorStop(0, HDR_BG_TOP);
  hdrGrad.addColorStop(1, HDR_BG_BOT);
  ctx.fillStyle = hdrGrad;
  ctx.fillRect(0, 0, POSTER_WIDTH, headerHeight);

  let curY = HDR_TOP;

  // 品牌 Logo 块
  const logoSz = 34;
  ctx.fillStyle = ACCENT_A;
  roundedRect(ctx, CL, curY, logoSz, logoSz, 9);
  ctx.fill();
  ctx.fillStyle = HDR_FG;
  ctx.font = `800 15px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("M", CL + logoSz / 2, curY + logoSz / 2 + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // 品牌文字
  ctx.fillStyle = HDR_FG;
  ctx.font = `700 15px ${FONT_FAMILY}`;
  ctx.fillText("MUHUB", CL + logoSz + 11, curY + 14);
  ctx.fillStyle = HDR_MUTED;
  ctx.font = `400 11px ${FONT_FAMILY}`;
  ctx.fillText("项目档案", CL + logoSz + 11, curY + 28);

  // 右侧小标签
  ctx.fillStyle = "#3f3f46";
  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.textAlign = "right";
  ctx.fillText("看见好项目", CR, curY + 20);
  ctx.textAlign = "left";

  curY += BRAND_H + BRAND_GAP;

  // 项目名
  ctx.font = `800 42px ${FONT_FAMILY}`;
  ctx.fillStyle = HDR_FG;
  for (const line of titleLines) {
    curY += TITLE_LINE_H;
    ctx.fillText(line, CL, curY);
  }
  curY += TITLE_GAP;

  // 简介
  ctx.font = `400 17px ${FONT_FAMILY}`;
  ctx.fillStyle = HDR_SUB;
  for (const line of introLines) {
    curY += INTRO_LINE_H;
    ctx.fillText(line, CL, curY);
  }

  // Tags / chips
  if (hasChips) {
    curY += CHIPS_GAP;
    ctx.font = `500 12px ${FONT_FAMILY}`;
    let chipX = CL;
    const chipPadX = 12;
    const chipH = 26;
    for (const chip of content.chips) {
      const text = chip.startsWith("#") ? chip : `#${chip}`;
      const w = ctx.measureText(text).width + chipPadX * 2;
      if (chipX + w > CR) break;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1;
      roundedRect(ctx, chipX, curY + 2, w, chipH, 999);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.textBaseline = "middle";
      ctx.fillText(text, chipX + chipPadX, curY + 2 + chipH / 2 + 1);
      ctx.textBaseline = "alphabetic";
      chipX += w + 8;
    }
  }

  // ── 品牌色渐变分隔线 ──────────────────────────────────────────────────
  const accentGrad = ctx.createLinearGradient(0, headerHeight, POSTER_WIDTH, headerHeight);
  accentGrad.addColorStop(0, ACCENT_A);
  accentGrad.addColorStop(0.5, ACCENT_B);
  accentGrad.addColorStop(1, ACCENT_C);
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, headerHeight, POSTER_WIDTH, ACCENT_H);

  // ── 内容区背景 ────────────────────────────────────────────────────────
  ctx.fillStyle = CONTENT_BG;
  ctx.fillRect(0, headerHeight + ACCENT_H, POSTER_WIDTH, contentHeight + FOOTER_H);

  curY = headerHeight + ACCENT_H + CONTENT_TOP_PAD;

  // ── Use Cases 卡片 ────────────────────────────────────────────────────
  if (content.useCases.length && useCaseBoxH > 0) {
    const boxX = CL;
    const boxY = curY;
    ctx.fillStyle = CONTENT_BG_ALT;
    roundedRect(ctx, boxX, boxY, CW, useCaseBoxH, 10);
    ctx.fill();

    const boxPad = 16;
    ctx.font = `600 11px ${FONT_FAMILY}`;
    ctx.fillStyle = CONTENT_MUTED;
    ctx.fillText("适合谁 / 使用场景", boxX + boxPad, boxY + boxPad + 2);

    let lineY = boxY + boxPad + 2 + 14 + 10;
    ctx.font = `400 15px ${FONT_FAMILY}`;
    ctx.fillStyle = CONTENT_SUB;
    for (const lines of wrappedUseCases) {
      for (const line of lines) {
        lineY += 22;
        ctx.fillText(line, boxX + boxPad, lineY);
      }
    }
    curY = boxY + useCaseBoxH + 20;
  }

  // ── 最新动态卡片 ──────────────────────────────────────────────────────
  if (content.latestActivity && activityBoxH > 0) {
    const boxX = CL;
    const boxY = curY;
    const boxPad = 16;

    ctx.fillStyle = CONTENT_BG;
    ctx.lineWidth = 1;
    ctx.strokeStyle = CONTENT_BORDER;
    roundedRect(ctx, boxX, boxY, CW, activityBoxH, 10);
    ctx.fill();
    ctx.stroke();

    // 左侧 teal 竖线
    ctx.fillStyle = ACCENT_A;
    roundedRect(ctx, boxX, boxY, 3, activityBoxH, 2);
    ctx.fill();

    let lineY = boxY + boxPad;

    ctx.font = `600 11px ${FONT_FAMILY}`;
    ctx.fillStyle = CONTENT_MUTED;
    ctx.fillText("最新动态", boxX + boxPad, lineY + 12);
    lineY += 22;

    ctx.font = `600 15px ${FONT_FAMILY}`;
    ctx.fillStyle = CONTENT_FG;
    for (const line of actTitleLines) {
      lineY += 22;
      ctx.fillText(line, boxX + boxPad, lineY);
    }

    if (actSumLines.length) {
      ctx.font = `400 13px ${FONT_FAMILY}`;
      ctx.fillStyle = CONTENT_SUB;
      lineY += 8;
      for (const line of actSumLines) {
        lineY += 20;
        ctx.fillText(line, boxX + boxPad, lineY);
      }
    }

    ctx.font = `400 11px ${FONT_FAMILY}`;
    ctx.fillStyle = CONTENT_MUTED;
    lineY += 10;
    ctx.fillText(
      formatPosterDate(content.latestActivity.occurredAt),
      boxX + boxPad,
      lineY + 12,
    );
    curY = boxY + activityBoxH + 20;
  }

  // ── 链接区 ────────────────────────────────────────────────────────────
  if (content.links.length) {
    ctx.fillStyle = CONTENT_BORDER;
    ctx.fillRect(CL, curY, CW, 1);
    curY += 16;

    ctx.font = `600 13px ${FONT_FAMILY}`;
    for (const link of content.links) {
      ctx.fillStyle = CONTENT_FG;
      ctx.fillText(link.label, CL, curY + 13);
      const lw = ctx.measureText(link.label).width;
      ctx.font = `400 13px ${FONT_FAMILY}`;
      ctx.fillStyle = CONTENT_LINK;
      const vl = wrapText(ctx, link.value, CW - lw - 12, 1);
      ctx.fillText(vl[0] ?? "", CL + lw + 10, curY + 13);
      curY += 26;
      ctx.font = `600 13px ${FONT_FAMILY}`;
    }
  }

  // ── Footer 背景 ───────────────────────────────────────────────────────
  const footerY = headerHeight + ACCENT_H + contentHeight;
  ctx.fillStyle = FOOTER_BG;
  ctx.fillRect(0, footerY, POSTER_WIDTH, FOOTER_H);
  ctx.fillStyle = CONTENT_BORDER;
  ctx.fillRect(0, footerY, POSTER_WIDTH, 1);

  // QR 码
  const qrX = CR - QR_SIZE;
  const qrY = footerY + (FOOTER_H - QR_SIZE) / 2;
  ctx.fillStyle = CONTENT_BG;
  ctx.lineWidth = 1;
  ctx.strokeStyle = CONTENT_BORDER;
  roundedRect(ctx, qrX - 8, qrY - 8, QR_SIZE + 16, QR_SIZE + 16, 10);
  ctx.fill();
  ctx.stroke();
  if (qrSource && qrSource.width > 0 && qrSource.height > 0) {
    ctx.drawImage(qrSource, qrX, qrY, QR_SIZE, QR_SIZE);
  }

  // Footer 文字
  const ftTextW = qrX - 24 - CL;
  const ftTextTop = qrY;
  ctx.font = `400 11px ${FONT_FAMILY}`;
  ctx.fillStyle = CONTENT_MUTED;
  const urlLines = wrapText(ctx, content.projectPageUrl, ftTextW, 2);
  let ftY = ftTextTop + 2;
  for (const line of urlLines) {
    ftY += 16;
    ctx.fillText(line, CL, ftY);
  }

  ctx.font = `700 18px ${FONT_FAMILY}`;
  ctx.fillStyle = CONTENT_FG;
  ftY += 28;
  ctx.fillText(SLOGAN, CL, ftY);

  ctx.font = `500 11px ${FONT_FAMILY}`;
  ctx.fillStyle = ACCENT_A;
  ftY += 18;
  ctx.fillText("muhub.cn", CL, ftY);

  return canvas;
}

// ─── React 组件 ───────────────────────────────────────────────────────────────

export function ProjectSharePoster(props: ProjectSharePosterProps) {
  const { slug, projectPageUrl } = props;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const generate = useCallback((): string | null => {
    setError("");
    try {
      const content = preparePoster(props);
      const canvas = renderPosterToCanvas(content, qrRef.current);
      const dataUrl = canvas.toDataURL("image/png");
      if (!dataUrl || dataUrl === "data:,") {
        throw new Error("生成的图像数据为空");
      }
      return dataUrl;
    } catch (e) {
      console.error("[ProjectSharePoster] generate failed", e);
      const message = e instanceof Error ? e.message : String(e);
      setError(`生成海报失败：${message || "未知错误"}`);
      return null;
    }
  }, [props]);

  useEffect(() => {
    if (!open) {
      setPreviewSrc(null);
      return;
    }
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const dataUrl = generate();
      if (dataUrl) setPreviewSrc(dataUrl);
    };
    const id1 = window.requestAnimationFrame(() => {
      const id2 = window.requestAnimationFrame(tick);
      void id2;
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id1);
    };
  }, [open, generate]);

  const downloadPng = useCallback(() => {
    setBusy(true);
    try {
      const dataUrl = previewSrc ?? generate();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.download = `muhub-${slug}-poster.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setBusy(false);
    }
  }, [previewSrc, generate, slug]);

  return (
    <>
      <button type="button" className={ghostBtnClass} onClick={() => setOpen(true)}>
        海报
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="poster-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="poster-dialog-title"
                  className="text-base font-semibold text-zinc-900 dark:text-zinc-50"
                >
                  生成项目海报
                </h2>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  预览海报，下载 PNG 后可直接分享到微信、微博、朋友圈。
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800"
                onClick={() => setOpen(false)}
                aria-label="关闭"
              >
                <span aria-hidden className="text-lg leading-none">×</span>
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50">
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewSrc}
                  alt={`${props.name} 项目海报预览`}
                  className="w-full rounded-xl"
                />
              ) : (
                <div className="flex h-72 w-full items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-zinc-500">
                    <span className="animate-pulse text-lg">⟳</span>
                    正在生成海报…
                  </div>
                </div>
              )}
            </div>

            {/* 隐藏 QRCodeCanvas，仅用于生成像素源 */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: -9999,
                top: 0,
                opacity: 0,
                pointerEvents: "none",
              }}
            >
              <QRCodeCanvas
                ref={qrRef}
                value={projectPageUrl}
                size={QR_SIZE}
                level="M"
                includeMargin={false}
              />
            </div>

            {error ? (
              <p
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
              <button
                type="button"
                disabled={busy || !previewSrc}
                className="flex-1 rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                onClick={downloadPng}
                data-testid="project-poster-download"
              >
                {busy ? "下载中…" : "下载海报 PNG"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

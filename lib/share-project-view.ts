import type { DemoUpdate, GithubSnapshotView, ProjectPageView } from "@/lib/demo-project";

/** 分享页「最近动态」最多条数 */
export const SHARE_RECENT_UPDATES_LIMIT = 2;

/** 项目名首字（或首字符），用于无 Logo 时的占位 */
export function projectShareInitial(name: string): string {
  const t = name.trim();
  if (!t) {
    return "?";
  }
  const first = [...t][0];
  return first ? first.toLocaleUpperCase("zh-CN") : "?";
}

export function takeRecentUpdatesForShare(updates: DemoUpdate[], limit = SHARE_RECENT_UPDATES_LIMIT): DemoUpdate[] {
  const sorted = [...updates].sort((a, b) => {
    const ta = (a.createdAt ?? a.occurredAt).getTime();
    const tb = (b.createdAt ?? b.occurredAt).getTime();
    return tb - ta;
  });
  return sorted.slice(0, limit);
}

/** 将长文切分为适合名片阅读的短段（最多 maxChunks 段） */
export function splitTextForShareHighlights(raw: string, maxChunks = 4): string[] {
  const t = raw.trim();
  if (!t) {
    return [];
  }
  const blocks = t
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (blocks.length > 1) {
    return blocks.slice(0, maxChunks);
  }
  const one = blocks[0] ?? t;
  if (one.length <= 220) {
    return [one];
  }
  const sentences = one.split(/(?<=[。！？.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= 1) {
    return [one.slice(0, 420) + (one.length > 420 ? "…" : "")];
  }
  const merged: string[] = [];
  let acc = "";
  for (const s of sentences) {
    const candidate = acc ? `${acc}${s}` : s;
    if (candidate.length > 200 && acc) {
      merged.push(acc);
      acc = s;
      if (merged.length >= maxChunks) {
        break;
      }
    } else {
      acc = candidate;
    }
  }
  if (acc && merged.length < maxChunks) {
    merged.push(acc);
  }
  return merged.slice(0, maxChunks).filter(Boolean);
}

export type ShareHighlightSource = "ai_card" | "description" | "tagline" | "placeholder";

/** 亮点文案：aiCardSummary → description → tagline，并做轻度切分 */
export function buildShareHighlightParagraphs(data: ProjectPageView): {
  paragraphs: string[];
  source: ShareHighlightSource;
} {
  const card = data.aiCardSummary?.trim();
  if (card) {
    return { paragraphs: splitTextForShareHighlights(card), source: "ai_card" };
  }
  const desc = data.description?.trim();
  if (desc) {
    return { paragraphs: splitTextForShareHighlights(desc), source: "description" };
  }
  const tag = data.tagline?.trim();
  if (tag) {
    return {
      paragraphs: [
        "当前公开信息以一句话定位为主；完整背景、指标与动态见下方链接与数据区。",
        `「${tag}」`,
      ],
      source: "tagline",
    };
  }
  return {
    paragraphs: ["该项目尚未补充详细介绍，欢迎通过下方仓库与主页进一步了解。"],
    source: "placeholder",
  };
}

export type ShareProgressModel =
  | {
      mode: "weekly";
      summary: string;
      windowHint?: string;
    }
  | {
      mode: "updates";
      updates: DemoUpdate[];
    }
  | {
      mode: "snapshot";
      lines: string[];
    }
  | {
      mode: "placeholder";
      message: string;
    };

function formatSnapshotProgressLines(snap: GithubSnapshotView): string[] {
  const lines: string[] = [];
  if (snap.latestReleaseTag) {
    const date = snap.latestReleaseAt
      ? `（${snap.latestReleaseAt.toLocaleDateString("zh-CN")}）`
      : "";
    lines.push(`最近版本 ${snap.latestReleaseTag}${date}`);
  }
  if (snap.lastCommitAt) {
    lines.push(`最近提交 ${snap.lastCommitAt.toLocaleString("zh-CN")}`);
  }
  if (lines.length > 0) {
    lines.push("仓库持续有提交与迭代，详细指标见页面后部。");
  }
  return lines;
}

/**
 * 当前进展：周总结 → 最近动态 → 仓库快照线索 → 温和占位
 */
export function buildShareProgressModel(
  data: ProjectPageView,
  recentUpdates: DemoUpdate[],
): ShareProgressModel {
  const weekly = data.aiWeeklySummary?.summary?.trim();
  if (weekly) {
    const w = data.aiWeeklySummary!;
    const windowHint = `${w.startAt.toLocaleDateString("zh-CN")} — ${w.endAt.toLocaleDateString("zh-CN")}`;
    return { mode: "weekly", summary: weekly, windowHint };
  }
  if (recentUpdates.length > 0) {
    return { mode: "updates", updates: recentUpdates };
  }
  const snap = data.githubSnapshot;
  if (snap && (snap.latestReleaseTag || snap.lastCommitAt)) {
    const lines = formatSnapshotProgressLines(snap);
    if (lines.length > 0) {
      return { mode: "snapshot", lines };
    }
  }
  return {
    mode: "placeholder",
    message: "欢迎关注仓库与主页，获取正式发布与迭代动态。",
  };
}

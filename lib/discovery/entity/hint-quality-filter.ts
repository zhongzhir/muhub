/**
 * Entity Hint 抽取质量过滤（E1 P0）
 */

import type { ExtractedEntityHintDraft } from "@/lib/discovery/entity/types";

/** 导航 / 功能入口 — 精确黑名单 */
export const NAVIGATION_BLACKLIST = new Set([
  "下载中心",
  "投稿指南",
  "期刊征订",
  "编辑部",
  "联系我们",
  "关于我们",
  "首页",
  "更多",
  "通知公告",
  "新闻动态",
  "网站首页",
  "返回首页",
  "栏目导航",
  "友情链接",
  "版权所有",
  "上一页",
  "下一页",
  "English",
  "中文版",
]);

/** 泛化词 / 栏目名 */
export const GENERIC_BLACKLIST = new Set([
  "关于",
  "通知",
  "公告",
  "名单",
  "公示",
  "试点",
  "单位",
  "有关",
  "开展",
  "工作",
  "发布",
  "新闻",
  "报道",
  "行业",
  "中国",
  "国家",
  "全国",
  "北京",
  "上海",
  "研究",
  "动态",
  "资讯",
  "专题",
  "栏目",
  "文章",
  "详情",
  "阅读全文",
  "点击查看",
  "数字出版",
  "人工智能",
  "大模型",
  "AIGC",
]);

/** 含这些词时，除非像机构/公司/实验室，否则视为低质量 */
const SUSPICIOUS_FRAGMENTS =
  /(?:中心|指南|通知|公告|下载|投稿|征订|编辑部|联系我们|关于我们|首页|更多|动态|资讯|栏目|导航)/;

const STRONG_ENTITY_SUFFIX =
  /(?:有限公司|有限责任公司|股份有限公司|科技公司|技术公司|集团|出版社|报刊社|期刊社|实验室|研究中心|研究院|研究基地|协会|学会|联合会|委员会|局|署|司|大学|学院)$/;

const WEBSITE_SCAN_MIN_CONFIDENCE = 0.75;

export type HintSkipCategory = "navigation" | "generic" | "lowQuality";

export type HintQualitySkipStats = {
  skippedNavigation: number;
  skippedGeneric: number;
  skippedLowQuality: number;
};

export type HintQualityFilterResult = {
  accepted: ExtractedEntityHintDraft[];
  skipped: Array<{ draft: ExtractedEntityHintDraft; category: HintSkipCategory; reason: string }>;
  stats: HintQualitySkipStats;
};

function normalizeForMatch(name: string): string {
  return name.trim().replace(/\s+/g, "");
}

const BAD_NAME_PREFIX =
  /^(?:本文|结合|重点|据介绍|记者|来源|作者|我们|该|其|这一|一个|未来趋势|据|从|在|与|和|对|为|以|将|被|把|让|给|向|由)/;

const BAD_NAME_PHRASE = /(?:重点介绍|竞争格局|发展趋势|未来趋势|本文|据介绍|概述|摘要|关键词)/;

export function classifyLowQualityHint(
  draft: ExtractedEntityHintDraft,
  options?: { isWebsiteScan?: boolean; minConfidence?: number },
): HintSkipCategory | null {
  const name = draft.name.trim();
  const normalized = normalizeForMatch(name);

  if (!name || name.length < 2) {
    return "generic";
  }

  if (NAVIGATION_BLACKLIST.has(normalized)) {
    return "navigation";
  }

  for (const nav of NAVIGATION_BLACKLIST) {
    if (normalized === nav || (normalized.length <= 6 && normalized.includes(nav))) {
      return "navigation";
    }
  }

  if (GENERIC_BLACKLIST.has(normalized)) {
    return "generic";
  }

  if (BAD_NAME_PREFIX.test(name) || BAD_NAME_PHRASE.test(name)) {
    return "generic";
  }

  if (
    options?.isWebsiteScan &&
    draft.evidenceJson?.ruleId === "award_project_row" &&
    draft.entityType === "PROJECT"
  ) {
    return null;
  }

  if (options?.isWebsiteScan && name.length > 20 && !STRONG_ENTITY_SUFFIX.test(name)) {
    return "generic";
  }

  if (options?.isWebsiteScan && name.length <= 3) {
    return "generic";
  }

  if (options?.isWebsiteScan && name.length <= 5 && !STRONG_ENTITY_SUFFIX.test(name)) {
    return "generic";
  }

  if (SUSPICIOUS_FRAGMENTS.test(name) && !STRONG_ENTITY_SUFFIX.test(name)) {
    if (/中心$/.test(name) && name.length <= 6) {
      return "navigation";
    }
    if (/(指南|通知|公告|下载|投稿|征订)$/.test(name)) {
      return "navigation";
    }
    if (!/(公司|集团|出版社|实验室|研究院|大学)/.test(name)) {
      return "generic";
    }
  }

  if (options?.isWebsiteScan) {
    const minConf = options.minConfidence ?? WEBSITE_SCAN_MIN_CONFIDENCE;
    if (draft.confidence < minConf) {
      return "lowQuality";
    }

    if (
      draft.entityType === "PROJECT" &&
      name.length > 28 &&
      !STRONG_ENTITY_SUFFIX.test(name) &&
      !/《/.test(name)
    ) {
      return "generic";
    }
  }

  return null;
}

export function filterEntityHintDrafts(
  drafts: ExtractedEntityHintDraft[],
  options?: { isWebsiteScan?: boolean; minConfidence?: number },
): HintQualityFilterResult {
  const accepted: ExtractedEntityHintDraft[] = [];
  const skipped: HintQualityFilterResult["skipped"] = [];
  const stats: HintQualitySkipStats = {
    skippedNavigation: 0,
    skippedGeneric: 0,
    skippedLowQuality: 0,
  };

  for (const draft of drafts) {
    const category = classifyLowQualityHint(draft, options);
    if (category) {
      skipped.push({
        draft,
        category,
        reason:
          category === "navigation"
            ? "navigation_blacklist"
            : category === "generic"
              ? "generic_or_column_name"
              : "low_confidence_website_scan",
      });
      if (category === "navigation") {
        stats.skippedNavigation += 1;
      } else if (category === "generic") {
        stats.skippedGeneric += 1;
      } else {
        stats.skippedLowQuality += 1;
      }
      continue;
    }
    accepted.push({
      ...draft,
      evidenceJson: {
        ...draft.evidenceJson,
        ...(options?.isWebsiteScan ? { context: "website_scan_filtered" } : {}),
      },
    });
  }

  return { accepted, skipped, stats };
}

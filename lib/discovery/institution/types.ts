/**
 * 机构型 Discovery 统一类型（与具体站点解耦，供 adapter 输入/输出共用）
 */

/** 来源形态：后续可扩展，公众号/企业名录等通过 article_feed、link_directory 等 mode 接入，不在此写死平台逻辑 */
export type InstitutionSourceMode =
  | "website_list"
  | "link_directory"
  | "article_feed"
  | "manual_seed";

/** manual_seed 模式下单条种子（亦可通过运营脚本写入 configJson） */
export type InstitutionManualSeedItem = {
  title: string;
  summary?: string;
  website?: string;
  externalUrl?: string;
  metadata?: Record<string, unknown>;
};

/** 各 adapter 解析后的统一条目，再标准化写入 DiscoveryCandidate */
export type InstitutionParsedItem = {
  title: string;
  summary?: string;
  externalUrl?: string;
  website?: string;
  /** 列表页/文章列表上的展示标题（如资讯标题） */
  sourceTitle?: string;
  /** 列表页条目链接（与 website 区分：线索可能先落在文章 URL） */
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
};

export const INSTITUTION_SOURCE_MODES: InstitutionSourceMode[] = [
  "website_list",
  "link_directory",
  "article_feed",
  "manual_seed",
];

export function isInstitutionSourceMode(v: string): v is InstitutionSourceMode {
  return (INSTITUTION_SOURCE_MODES as readonly string[]).includes(v);
}

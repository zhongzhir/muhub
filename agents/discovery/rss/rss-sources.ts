import type { RssSource } from "./rss-types";

export const rssSources: RssSource[] = [
  // ── 国际来源 ──────────────────────────────────────────────────────────────────
  {
    name: "Product Hunt",
    url: "https://www.producthunt.com/feed",
    sourceType: "rss-producthunt",
  },
  {
    name: "GitHub Trending",
    url: "https://github.com/trending?since=daily",
    sourceType: "rss-github",
  },

  // ── 中国科技媒体 ─────────────────────────────────────────────────────────────────────
  // 来自以下来源的条目会在 china-affinity 检测时命中 source_origin_china 信号，
  // 并在 review-priority 阶段获得额外加权，优先推送审核。
  {
    name: "36氪",
    url: "https://36kr.com/feed",
    sourceType: "rss-news-cn",
    isChinaSource: true,
  },
  {
    name: "虎導",
    url: "https://www.huxiu.com/rss/0.xml",
    sourceType: "rss-news-cn",
    isChinaSource: true,
  },
  {
    name: "少数派",
    url: "https://sspai.com/feed",
    sourceType: "rss-news-cn",
    isChinaSource: true,
  },
  {
    name: "V2EX 技术",
    url: "https://www.v2ex.com/feed/tab/tech.xml",
    sourceType: "rss-community-cn",
    isChinaSource: true,
  },
  {
    name: "InfoQ 中文",
    url: "https://feed.infoq.com/cn/",
    sourceType: "rss-news-cn",
    isChinaSource: true,
  },
];

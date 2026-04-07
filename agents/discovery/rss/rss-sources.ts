import type { RssSource } from "./rss-types";

export const rssSources: RssSource[] = [
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
];

import type { InstitutionAdapter } from "@/lib/discovery/institution/institution-adapter";
import { fetchInstitutionHtml } from "@/lib/discovery/institution/http-fetch";
import { parseHtmlLinkItems } from "@/lib/discovery/institution/parse-html-links";

/**
 * 资讯 / 文章列表页 → 项目线索（不实现公众号协议；预留 mode，后续可换 RSS、抓取中间层等）
 */
export const articleFeedAdapter: InstitutionAdapter = {
  key: "article_feed",

  match(config) {
    return config.mode === "article_feed";
  },

  async fetch(config) {
    const res = await fetchInstitutionHtml(config.url);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    return {
      ok: true,
      html: res.html,
      fetchedUrl: res.fetchedUrl,
      meta: {
        adapter: "article_feed",
        reservedForWechatArticleList: true,
        note: "Do not embed WeChat-specific logic here; use future feed/RSS/bridge.",
      },
    };
  },

  parse(ok, config) {
    const html = ok.html;
    if (!html) {
      return [];
    }
    const items = parseHtmlLinkItems(html, ok.fetchedUrl ?? config.url, {
      entryKind: "article_feed_clue",
    });
    return items.map((it) => ({
      ...it,
      sourceTitle: it.title,
      sourceUrl: it.externalUrl ?? it.website,
      metadata: {
        ...(it.metadata ?? {}),
        clueType: "article_link",
        reservedForWechat: true,
      },
    }));
  },
};

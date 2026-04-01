import type { InstitutionAdapter } from "@/lib/discovery/institution/institution-adapter";
import { fetchInstitutionHtml } from "@/lib/discovery/institution/http-fetch";
import { parseHtmlLinkItems } from "@/lib/discovery/institution/parse-html-links";

/** 通用「项目/入驻企业」列表页 HTML（产业园官网、开放平台目录等） */
export const websiteListAdapter: InstitutionAdapter = {
  key: "website_list",

  match(config) {
    return config.mode === "website_list";
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
      meta: { adapter: "website_list" },
    };
  },

  parse(ok, config) {
    const html = ok.html;
    if (!html) {
      return [];
    }
    return parseHtmlLinkItems(html, ok.fetchedUrl ?? config.url, {
      entryKind: "website_list",
    });
  },
};

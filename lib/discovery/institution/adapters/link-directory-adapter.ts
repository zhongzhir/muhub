import type { InstitutionAdapter } from "@/lib/discovery/institution/institution-adapter";
import { fetchInstitutionHtml } from "@/lib/discovery/institution/http-fetch";
import { parseHtmlLinkItems } from "@/lib/discovery/institution/parse-html-links";

/**
 * 企业名录、理事单位、合作伙伴官网列表等（解析策略与 website_list 同基类，语义与 metadata 区分，便于后续换专用解析器）
 */
export const linkDirectoryAdapter: InstitutionAdapter = {
  key: "link_directory",

  match(config) {
    return config.mode === "link_directory";
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
      meta: { adapter: "link_directory" },
    };
  },

  parse(ok, config) {
    const html = ok.html;
    if (!html) {
      return [];
    }
    return parseHtmlLinkItems(html, ok.fetchedUrl ?? config.url, {
      entryKind: "link_directory",
    });
  },
};

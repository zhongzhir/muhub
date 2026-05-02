export type ProjectUrlRole =
  | "github"
  | "source_article_wechat"
  | "platform_project_page"
  | "website"
  | "source_article"
  | "external";

export type ClassifiedProjectUrl = {
  role: ProjectUrlRole;
  url: string;
  host: string;
  platform: string;
  label: string;
};

const SOURCE_ARTICLE_HOSTS = [
  "36kr.com",
  "huxiu.com",
  "juejin.cn",
  "medium.com",
  "sspai.com",
  "tmtpost.com",
  "weixin.qq.com",
  "zhihu.com",
];

function normalizeHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return null;
    }
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

function plainHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function classifyProjectUrl(raw: string): ClassifiedProjectUrl | null {
  const u = normalizeHttpUrl(raw);
  if (!u) {
    return null;
  }
  const host = plainHost(u.hostname);
  const normalized = u.toString();

  if (host === "github.com") {
    return {
      role: "github",
      url: normalized,
      host,
      platform: "github",
      label: "GitHub",
    };
  }

  if (host === "mp.weixin.qq.com") {
    return {
      role: "source_article_wechat",
      url: normalized,
      host,
      platform: "wechat",
      label: "微信公众号文章",
    };
  }

  if (host === "gitcc.com") {
    return {
      role: "platform_project_page",
      url: normalized,
      host,
      platform: "gitcc",
      label: "GitCC 项目页",
    };
  }

  if (host === "producthunt.com") {
    return {
      role: "platform_project_page",
      url: normalized,
      host,
      platform: "producthunt",
      label: "Product Hunt 项目页",
    };
  }

  if (SOURCE_ARTICLE_HOSTS.some((sourceHost) => host === sourceHost || host.endsWith(`.${sourceHost}`))) {
    return {
      role: "source_article",
      url: normalized,
      host,
      platform: host,
      label: "来源文章",
    };
  }

  return {
    role: "website",
    url: normalized,
    host,
    platform: "website",
    label: "官网",
  };
}

export function isSourceArticleUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) {
    return false;
  }
  const classified = classifyProjectUrl(raw);
  return classified?.role === "source_article_wechat" || classified?.role === "source_article";
}

export function isProjectPrimaryUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) {
    return false;
  }
  const classified = classifyProjectUrl(raw);
  return (
    classified?.role === "github" ||
    classified?.role === "platform_project_page" ||
    classified?.role === "website"
  );
}

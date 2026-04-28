export type ShareTemplateId = "short" | "community" | "twitter";

/** 简短中文（默认复制） */
export function buildShortShareText(title: string, url: string): string {
  return `我在 MUHUB 上发布了一个项目：\n\n${title}\n\n${url}`;
}

/** 社群/微信偏好的多行介绍 */
export function buildCommunityShareText(title: string, description: string, url: string): string {
  const body = description.trim() || title;
  return `我最近在做一个项目：\n\n${title}\n\n${body}\n\n欢迎关注：\n${url}`;
}

/** 社交平台短帖 */
export function buildTwitterShareText(title: string, url: string): string {
  return `我在 MUHUB 上分享了一个项目：\n\n${title}\n\n${url}`;
}

export function buildTwitterIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

type ShareInput = {
  title: string;
  url: string;
  /** 用于社群文案正文；可为简介/介绍摘抄 */
  descriptionLine: string;
};

export function getShareTextByTemplate(id: ShareTemplateId, input: ShareInput): string {
  switch (id) {
    case "short":
      return buildShortShareText(input.title, input.url);
    case "community":
      return buildCommunityShareText(input.title, input.descriptionLine, input.url);
    case "twitter":
      return buildTwitterShareText(input.title, input.url);
  }
}

/** 社群正文：介绍优先，否则标语/摘要/标题 */
export function resolveCommunityDescriptionBody(
  description: string | undefined,
  tagline: string | undefined,
  shareSnippet: string,
  name: string,
  maxLen = 480,
): string {
  const raw = (description?.trim() || tagline?.trim() || shareSnippet.trim() || name).replace(/\r\n/g, "\n");
  if (raw.length <= maxLen) {
    return raw;
  }
  return `${raw.slice(0, maxLen - 1).trimEnd()}…`;
}

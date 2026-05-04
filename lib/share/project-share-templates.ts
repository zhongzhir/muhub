export type ShareTemplateId = "short" | "community" | "weibo";

function cleanDescription(description: string): string {
  return description.trim().replace(/\n{3,}/g, "\n\n");
}

export function buildShortShareText(title: string, url: string): string {
  return `我在 MUHUB 发现了一个项目：${title}\n查看项目：${url}`;
}

export function buildCommunityShareText(title: string, description: string, url: string): string {
  const body = cleanDescription(description) || title;
  return `我在 MUHUB 发现了一个项目：${title}\n${body}\n查看项目：${url}`;
}

export function buildWeiboShareText(title: string, description: string, url: string): string {
  const body = cleanDescription(description);
  return body
    ? `我在 MUHUB 发现了一个项目：${title}\n${body}\n查看项目：${url}`
    : `我在 MUHUB 发现了一个项目：${title}\n查看项目：${url}`;
}

export function buildTwitterShareText(title: string, url: string): string {
  return buildShortShareText(title, url);
}

type ShareInput = {
  title: string;
  url: string;
  descriptionLine: string;
};

export function getShareTextByTemplate(id: ShareTemplateId, input: ShareInput): string {
  switch (id) {
    case "short":
      return buildShortShareText(input.title, input.url);
    case "community":
      return buildCommunityShareText(input.title, input.descriptionLine, input.url);
    case "weibo":
      return buildWeiboShareText(input.title, input.descriptionLine, input.url);
  }
}

export function resolveCommunityDescriptionBody(
  description: string | undefined,
  tagline: string | undefined,
  shareSnippet: string,
  name: string,
  maxLen = 180,
): string {
  const raw = (description?.trim() || tagline?.trim() || shareSnippet.trim() || name).replace(/\r\n/g, "\n");
  if (raw.length <= maxLen) {
    return raw;
  }
  return `${raw.slice(0, maxLen - 1).trimEnd()}…`;
}

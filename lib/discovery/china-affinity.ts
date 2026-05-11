export type ChinaAffinitySignalKind =
  | "source_origin_china"
  | "operation_in_china"
  | "team_lead_china"
  | "team_member_china"
  | "language_or_platform_hint";

export type ChinaAffinitySignal = {
  kind: ChinaAffinitySignalKind;
  label: string;
  evidence: string;
  strength: "strong" | "medium" | "weak";
};

export type ChinaAffinityInput = {
  title?: string | null;
  summary?: string | null;
  descriptionRaw?: string | null;
  website?: string | null;
  docsUrl?: string | null;
  repoUrl?: string | null;
  language?: string | null;
  enrichmentLinks?: { platform: string; url: string }[];
  evidenceText?: string | null;
};

const MAX_SIGNALS = 8;

const SOURCE_HOST_PATTERNS = [
  "mp.weixin.qq.com",
  "gitee.com",
  "gitcode.com",
  "gitcc.com",
  "juejin.cn",
  "zhihu.com",
  "bilibili.com",
  "xiaohongshu.com",
  "douyin.com",
];

const SOURCE_TEXT_PATTERNS = [
  "微信公众号",
  "公众号",
  "微信",
  "掘金",
  "知乎",
  "哔哩",
  "bilibili",
  "小红书",
  "抖音",
  "Gitee",
  "GitCode",
];

const OPERATION_PATTERNS = [
  "中国市场",
  "国内市场",
  "中国用户",
  "国内用户",
  "中国大陆",
  "国内版",
  "中文版",
  "中文官网",
  "面向中国",
  "面向国内",
  "在中国运营",
  "国内运营",
  "国产",
  "备案号",
  "ICP备案",
  "京ICP备",
  "沪ICP备",
  "粤ICP备",
];

const TEAM_LEAD_PATTERNS = [
  "中国团队",
  "国内团队",
  "中国创业团队",
  "华人团队",
  "创始人来自中国",
  "创始人是中国",
  "负责人来自中国",
  "中国创始人",
  "北京团队",
  "上海团队",
  "深圳团队",
  "杭州团队",
  "广州团队",
  "based in China",
  "China-based team",
  "Chinese founder",
  "Chinese team",
];

const TEAM_MEMBER_PATTERNS = [
  "中国开发者",
  "国内开发者",
  "华人开发者",
  "中国成员",
  "国内成员",
  "中文维护者",
  "Chinese developer",
  "Chinese maintainer",
];

const LANGUAGE_HINT_PATTERNS = ["中文", "简体中文", "繁体中文", "汉语", "华语", "zh-CN", "zh_CN"];

function normalizeText(input: string): string {
  return input.toLowerCase();
}

function includesAny(haystack: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    if (haystack.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  return null;
}

function hostSignals(urls: string[]): string | null {
  for (const raw of urls) {
    try {
      const host = new URL(raw).hostname.toLowerCase();
      if (host.endsWith(".cn")) {
        return host;
      }
      const matched = SOURCE_HOST_PATTERNS.find((pattern) => host === pattern || host.endsWith(`.${pattern}`));
      if (matched) {
        return host;
      }
    } catch {
      // Ignore non-URL fragments from evidence text.
    }
  }
  return null;
}

function pushUnique(out: ChinaAffinitySignal[], signal: ChinaAffinitySignal) {
  if (out.some((item) => item.kind === signal.kind && item.evidence === signal.evidence)) {
    return;
  }
  out.push(signal);
}

export function detectChinaAffinitySignals(input: ChinaAffinityInput): ChinaAffinitySignal[] {
  const urls = [
    input.website,
    input.docsUrl,
    input.repoUrl,
    ...(input.enrichmentLinks ?? []).map((link) => link.url),
  ].filter((x): x is string => Boolean(x?.trim()));

  const text = [
    input.title,
    input.summary,
    input.descriptionRaw,
    input.language,
    input.evidenceText,
    ...(input.enrichmentLinks ?? []).map((link) => `${link.platform} ${link.url}`),
    ...urls,
  ]
    .filter((x): x is string => Boolean(x?.trim()))
    .join("\n");

  const haystack = normalizeText(text);
  const signals: ChinaAffinitySignal[] = [];

  const sourceHost = hostSignals(urls);
  const sourceText = includesAny(haystack, SOURCE_TEXT_PATTERNS);
  if (sourceHost || sourceText) {
    pushUnique(signals, {
      kind: "source_origin_china",
      label: "中国来源渠道",
      evidence: sourceHost ? `matched Chinese source host: ${sourceHost}` : `matched Chinese source text: ${sourceText}`,
      strength: sourceHost ? "medium" : "weak",
    });
  }

  const operation = includesAny(haystack, OPERATION_PATTERNS);
  if (operation) {
    pushUnique(signals, {
      kind: "operation_in_china",
      label: "面向中国运营或市场",
      evidence: `matched China operation hint: ${operation}`,
      strength: "strong",
    });
  }

  const teamLead = includesAny(haystack, TEAM_LEAD_PATTERNS);
  if (teamLead) {
    pushUnique(signals, {
      kind: "team_lead_china",
      label: "中国团队或负责人",
      evidence: `matched China team lead hint: ${teamLead}`,
      strength: "strong",
    });
  }

  const teamMember = includesAny(haystack, TEAM_MEMBER_PATTERNS);
  if (teamMember) {
    pushUnique(signals, {
      kind: "team_member_china",
      label: "团队包含中国成员",
      evidence: `matched China team member hint: ${teamMember}`,
      strength: "medium",
    });
  }

  const language = (input.language ?? "").toLowerCase();
  const languageHint =
    language.startsWith("zh") || language.includes("chinese")
      ? input.language
      : includesAny(haystack, LANGUAGE_HINT_PATTERNS);
  if (languageHint) {
    pushUnique(signals, {
      kind: "language_or_platform_hint",
      label: "中文语言或平台线索",
      evidence: `matched Chinese language/platform hint: ${languageHint}`,
      strength: "weak",
    });
  }

  return signals.slice(0, MAX_SIGNALS);
}

export function chinaAffinityPriorityPoints(signals: ChinaAffinitySignal[]): number {
  if (!signals.length) {
    return 0;
  }
  const raw = signals.reduce((sum, signal) => {
    if (signal.strength === "strong") return sum + 24;
    if (signal.strength === "medium") return sum + 16;
    return sum + 8;
  }, 0);
  return Math.min(32, raw);
}

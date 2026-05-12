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
  "\u5fae\u4fe1\u516c\u4f17\u53f7",
  "\u516c\u4f17\u53f7",
  "\u5fae\u4fe1",
  "\u6398\u91d1",
  "\u77e5\u4e4e",
  "\u54d4\u54e9",
  "bilibili",
  "\u5c0f\u7ea2\u4e66",
  "\u6296\u97f3",
  "Gitee",
  "GitCode",
];

const OPERATION_PATTERNS = [
  "\u4e2d\u56fd\u5e02\u573a",
  "\u56fd\u5185\u5e02\u573a",
  "\u4e2d\u56fd\u7528\u6237",
  "\u56fd\u5185\u7528\u6237",
  "\u4e2d\u56fd\u5927\u9646",
  "\u56fd\u5185\u7248",
  "\u4e2d\u6587\u7248",
  "\u4e2d\u6587\u5b98\u7f51",
  "\u9762\u5411\u4e2d\u56fd",
  "\u9762\u5411\u56fd\u5185",
  "\u5728\u4e2d\u56fd\u8fd0\u8425",
  "\u56fd\u5185\u8fd0\u8425",
  "\u56fd\u4ea7",
  "\u5907\u6848\u53f7",
  "ICP\u5907\u6848",
  "\u4eacICP\u5907",
  "\u6cbcICP\u5907",
  "\u7ca4ICP\u5907",
];

const TEAM_LEAD_PATTERNS = [
  "\u4e2d\u56fd\u56e2\u961f",
  "\u56fd\u5185\u56e2\u961f",
  "\u4e2d\u56fd\u521b\u4e1a\u56e2\u961f",
  "\u534e\u4eba\u56e2\u961f",
  "\u521b\u59cb\u4eba\u6765\u81ea\u4e2d\u56fd",
  "\u521b\u59cb\u4eba\u662f\u4e2d\u56fd",
  "\u8d1f\u8d23\u4eba\u6765\u81ea\u4e2d\u56fd",
  "\u4e2d\u56fd\u521b\u59cb\u4eba",
  "\u5317\u4eac\u56e2\u961f",
  "\u4e0a\u6d77\u56e2\u961f",
  "\u6df1\u5733\u56e2\u961f",
  "\u676d\u5dde\u56e2\u961f",
  "\u5e7f\u5dde\u56e2\u961f",
  "based in China",
  "China-based team",
  "Chinese founder",
  "Chinese team",
];

const TEAM_MEMBER_PATTERNS = [
  "\u4e2d\u56fd\u5f00\u53d1\u8005",
  "\u56fd\u5185\u5f00\u53d1\u8005",
  "\u534e\u4eba\u5f00\u53d1\u8005",
  "\u4e2d\u56fd\u6210\u5458",
  "\u56fd\u5185\u6210\u5458",
  "\u4e2d\u6587\u7ef4\u62a4\u8005",
  "Chinese developer",
  "Chinese maintainer",
];

const LANGUAGE_HINT_PATTERNS = ["\u4e2d\u6587", "\u7b80\u4f53\u4e2d\u6587", "\u7e41\u4f53\u4e2d\u6587", "\u6c49\u8bed", "\u534e\u8bed", "zh-CN", "zh_CN"];

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
      label: "\u4e2d\u56fd\u6765\u6e90\u6e20\u9053",
      evidence: sourceHost ? `matched Chinese source host: ${sourceHost}` : `matched Chinese source text: ${sourceText}`,
      strength: sourceHost ? "medium" : "weak",
    });
  }

  const operation = includesAny(haystack, OPERATION_PATTERNS);
  if (operation) {
    pushUnique(signals, {
      kind: "operation_in_china",
      label: "\u9762\u5411\u4e2d\u56fd\u8fd0\u8425\u6216\u5e02\u573a",
      evidence: `matched China operation hint: ${operation}`,
      strength: "strong",
    });
  }

  const teamLead = includesAny(haystack, TEAM_LEAD_PATTERNS);
  if (teamLead) {
    pushUnique(signals, {
      kind: "team_lead_china",
      label: "\u4e2d\u56fd\u56e2\u961f\u6216\u8d1f\u8d23\u4eba",
      evidence: `matched China team lead hint: ${teamLead}`,
      strength: "strong",
    });
  }

  const teamMember = includesAny(haystack, TEAM_MEMBER_PATTERNS);
  if (teamMember) {
    pushUnique(signals, {
      kind: "team_member_china",
      label: "\u56e2\u961f\u5305\u542b\u4e2d\u56fd\u6210\u5458",
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
      label: "\u4e2d\u6587\u8bed\u8a00\u6216\u5e73\u53f0\u7ebf\u7d22",
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

/**
 * \u57fa\u4e8e\u4fe1\u53f7\u96c6\u5408\u63a8\u65ad\u4e2d\u56fd\u9879\u76ee\u7f6e\u4fe1\u5ea6\u3002
 *
 * - "confirmed"\uff1a\u6709\u660e\u786e\u7684\u8fd0\u8425\u6216\u56e2\u961f\u5f3a\u4fe1\u53f7\uff08ICP \u5907\u6848\u3001\u4e2d\u56fd\u56e2\u961f\u3001Chinese founder \u7b49\uff09\uff0c
 *   \u6216\u7d2f\u8ba1 2 \u6761\u53ca\u4ee5\u4e0a\u5f3a\u4fe1\u53f7\u2014\u2014\u53ef\u76f4\u63a5\u6253\u201c\u4e2d\u56fd\u9879\u76ee\u201d\u6807\u7b7e\u3002
 * - "likely"\uff1a\u67091 \u6761\u5f3a\u4fe1\u53f7\uff0c\u6216 2 \u6761\u53ca\u4ee5\u4e0a\u4e2d\u7b49\u4fe1\u53f7\uff0c\u4e0d\u8db3\u4ee5\u201c\u786e\u8ba4\u201d\u4f46\u6982\u7387\u5f88\u9ad8\u2014\u2014
 *   \u53ef\u6253\u201c\u7591\u662f\u4e2d\u56fd\u9879\u76ee\u201d\u6807\u7b7e\u3002
 * - "possible"\uff1a\u4ec5\u6709\u5f31\u4fe1\u53f7\uff08\u4e2d\u6587\u8bed\u8a00\u63d0\u793a\u3001\u4e2d\u56fd\u5a92\u4f53\u6e20\u9053\u6587\u5b57\u5339\u914d\u7b49\uff09\u2014\u2014
 *   \u53ef\u6253\u201c\u7591\u662f\u4e2d\u56fd\u9879\u76ee\u201d\u6807\u7b7e\uff0c\u6743\u91cd\u8f83\u4f4e\u3002
 * - "none"\uff1a\u65e0\u4efb\u4f55\u4fe1\u53f7\u3002
 */
export type ChinaAffinityConfidence = "confirmed" | "likely" | "possible" | "none";

export function chinaAffinityConfidenceLevel(signals: ChinaAffinitySignal[]): ChinaAffinityConfidence {
  if (!signals.length) return "none";

  const hasDefinitiveSignal = signals.some(
    (s) =>
      s.strength === "strong" &&
      (s.kind === "operation_in_china" || s.kind === "team_lead_china"),
  );

  const strongCount = signals.filter((s) => s.strength === "strong").length;
  const mediumCount = signals.filter((s) => s.strength === "medium").length;
  const points = chinaAffinityPriorityPoints(signals);

  if (hasDefinitiveSignal || strongCount >= 2 || points >= 32) {
    return "confirmed";
  }
  if (strongCount >= 1 || mediumCount >= 2 || points >= 16) {
    return "likely";
  }
  return "possible";
}

/**
 * \u6839\u636e\u7f6e\u4fe1\u5ea6\u8fd4\u56de\u63a8\u8350\u7684\u516c\u5f00\u6807\u7b7e\u6587\u5b57\u3002
 * - "confirmed" / "likely" \u2192 "\u4e2d\u56fd\u9879\u76ee"
 * - "possible"            \u2192 "\u7591\u662f\u4e2d\u56fd\u9879\u76ee"
 * - "none"                \u2192 null\uff08\u4e0d\u6253\u6807\u7b7e\uff09
 */
export function chinaAffinityTag(confidence: ChinaAffinityConfidence): string | null {
  if (confidence === "confirmed" || confidence === "likely") return "\u4e2d\u56fd\u9879\u76ee";
  if (confidence === "possible") return "\u7591\u662f\u4e2d\u56fd\u9879\u76ee";
  return null;
}

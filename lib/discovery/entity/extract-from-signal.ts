import type { DiscoverySourceType } from "@prisma/client";
import {
  authorityTierBoost,
  type EntityHintExtractionResult,
  type ExtractedEntityHintDraft,
  type SourceAuthorityTier,
} from "@/lib/discovery/entity/types";
import { normalizeEntityName } from "@/lib/discovery/entity/normalize-name";
import {
  filterEntityHintDrafts,
  GENERIC_BLACKLIST,
  NAVIGATION_BLACKLIST,
  type HintQualitySkipStats,
} from "@/lib/discovery/entity/hint-quality-filter";
import {
  aiJudgedEntitiesToHintDrafts,
  runAiEntityJudge,
} from "@/lib/discovery/entity/ai-entity-judge";

export type SignalExtractionInput = {
  signalId: string;
  title: string;
  summary?: string | null;
  rawText?: string | null;
  url: string;
  signalType: string;
  sourceType: DiscoverySourceType;
  sourceName: string;
  guessedProjectName?: string | null;
  guessedWebsiteUrl?: string | null;
  guessedGithubUrl?: string | null;
  discoveryScopes: string[];
  sourceAuthorityTier?: SourceAuthorityTier;
  metadataJson?: unknown;
  useAi?: boolean;
  /** 显式启用 AI Entity Judge（WEBSITE_SCAN 默认启用） */
  useAiJudge?: boolean;
  noAiJudge?: boolean;
  minConfidence?: number;
  minRelevance?: number;
};

const NOISE_NAMES = GENERIC_BLACKLIST;

const WEBSITE_SCAN_MIN_CONFIDENCE = 0.75;

const LAB_SUFFIX =
  /([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,40}(?:人工智能|AI|智能|数字出版|出版)?(?:实验室|研究中心|研究院|研究基地))/g;
const ORG_SUFFIX =
  /([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,40}(?:协会|学会|联合会|出版社|新闻出版|报刊|期刊社|报刊社|中心|委员会|局|署|司))/g;
const COMPANY_SUFFIX =
  /([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,40}(?:有限公司|有限责任公司|股份有限公司|科技公司|技术公司|集团))/g;
const EVENT_SUFFIX =
  /([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,50}(?:论坛|峰会|大会|研讨会|年会|博览会|展会|会议))/g;

function isWebsiteScanSignal(input: SignalExtractionInput): boolean {
  return input.signalType === "WEBSITE_SCAN";
}

function combinedText(input: SignalExtractionInput): string {
  return [input.title, input.summary, input.rawText]
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .join("\n");
}

function isValidEntityName(name: string, options?: { isWebsiteScan?: boolean }): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return false;
  }
  if (NOISE_NAMES.has(trimmed) || NAVIGATION_BLACKLIST.has(trimmed)) {
    return false;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  if (/^\d+$/.test(trimmed)) {
    return false;
  }
  if (options?.isWebsiteScan && trimmed.length <= 4 && !/(公司|集团|实验室|大学|出版社)/.test(trimmed)) {
    return false;
  }
  return true;
}

function clampConfidence(base: number, tier: SourceAuthorityTier): number {
  return Math.min(0.95, Math.max(0.1, base + authorityTierBoost(tier)));
}

function pushUnique(
  out: ExtractedEntityHintDraft[],
  seen: Set<string>,
  draft: ExtractedEntityHintDraft,
  options?: { isWebsiteScan?: boolean },
): void {
  const key = `${normalizeEntityName(draft.name)}:${draft.entityType}`;
  if (seen.has(key)) {
    return;
  }
  if (!isValidEntityName(draft.name, options)) {
    return;
  }
  seen.add(key);
  out.push(draft);
}

function extractQuotedNames(text: string): string[] {
  const names: string[] = [];
  const patterns = [
    /《([^《》]{2,40})》/g,
    /「([^」]{2,40})」/g,
    /"([^"]{2,40})"/g,
    /'([^']{2,40})'/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = m[1]?.trim();
      if (name) {
        names.push(name);
      }
    }
  }
  return names;
}

function extractListNames(text: string): string[] {
  const names: string[] = [];
  const listLine =
    /(?:名单|单位|机构|实验室|试点|入选)[：:]\s*([^\n。；;]{4,200})/i.exec(text);
  if (listLine?.[1]) {
    const parts = listLine[1].split(/[、，,；;\s]+/);
    for (const part of parts) {
      const cleaned = part.replace(/^\d+[.)、\s]*/, "").trim();
      if (cleaned.length >= 2) {
        names.push(cleaned);
      }
    }
  }
  return names;
}

function extractAwardProjectRows(
  text: string,
  tier: SourceAuthorityTier,
): ExtractedEntityHintDraft[] {
  const out: ExtractedEntityHintDraft[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const match =
      /^\d{1,3}[\s.、)）]+(.+?)(?:\s{2,}|\t|\||｜|$)/.exec(trimmed) ??
      /^项目[:：]\s*(.+?)(?:\s{2,}|\t|\||｜|$)/.exec(trimmed);
    const name = match?.[1]?.trim();
    if (!name || name.length < 4 || name.length > 80) {
      continue;
    }
    if (!/(项目|平台|系统|中心|云|库|应用|服务|软件|工程|建设|基座|大数据|AI|智能)/i.test(name)) {
      continue;
    }
    out.push({
      name,
      entityType: inferTypeFromName(name),
      confidence: clampConfidence(0.82, tier),
      reason: "award_or_table_project_row",
      sourceTextSnippet: trimmed.slice(0, 200),
      evidenceJson: {
        extractionMethod: "rule",
        ruleId: "award_project_row",
      },
    });
  }
  return out;
}

function extractKnownPublishingOrganizations(
  text: string,
  tier: SourceAuthorityTier,
): ExtractedEntityHintDraft[] {
  const known = [
    "Pearson",
    "Cengage",
    "McGraw-Hill",
    "Amazon",
    "Apple",
    "Elsevier",
    "Springer",
    "Springer Nature",
    "Wiley",
    "Taylor & Francis",
    "SAGE",
    "Oxford University Press",
    "Cambridge University Press",
  ];
  const out: ExtractedEntityHintDraft[] = [];
  for (const name of known) {
    const index = text.toLowerCase().indexOf(name.toLowerCase());
    if (index < 0) {
      continue;
    }
    const context = text.slice(Math.max(0, index - 180), index + name.length + 220);
    out.push({
      name,
      entityType: name === "Amazon" || name === "Apple" ? "PLATFORM" : "ORGANIZATION",
      confidence: clampConfidence(0.8, tier),
      reason: "known_publishing_organization_mentioned",
      sourceTextSnippet: context.slice(0, 240),
      evidenceJson: {
        extractionMethod: "rule",
        ruleId: "known_publishing_organization",
      },
    });
  }
  return out;
}

function extractLaunchProducts(text: string, tier: SourceAuthorityTier): ExtractedEntityHintDraft[] {
  const out: ExtractedEntityHintDraft[] = [];
  const patterns = [
    /(?:发布|推出|上线|亮相|推出)\s*[「《]?([\u4e00-\u9fa5A-Za-z0-9·\-]{2,30})[》」]?/g,
    /([\u4e00-\u9fa5A-Za-z0-9·\-]{2,30})\s*(?:AI|智能)?(?:工具|平台|系统|助手|引擎|产品)(?:正式)?(?:发布|上线|推出)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const name = m[1]?.trim();
      if (!name || !isValidEntityName(name)) {
        continue;
      }
      out.push({
        name,
        entityType: /工具|引擎/.test(m[0]) ? "TOOL" : "PROJECT",
        confidence: clampConfidence(0.62, tier),
        reason: "新闻/公告中的产品发布模式",
        sourceTextSnippet: m[0].slice(0, 120),
        evidenceJson: {
          extractionMethod: "rule",
          ruleId: "launch_product_pattern",
        },
      });
    }
  }
  return out;
}

function normalizeOrgExtract(raw: string): string {
  const m = raw.match(
    /([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,30}(?:有限公司|有限责任公司|股份有限公司|科技公司|技术公司|集团|出版社|报刊社|期刊社|实验室|研究中心|研究院|研究基地|协会|学会|联合会|委员会|局|署|司|大学|学院))$/,
  );
  return m?.[1]?.trim() ?? raw.trim();
}

function extractByRegex(
  text: string,
  re: RegExp,
  entityType: string,
  ruleId: string,
  baseConfidence: number,
  tier: SourceAuthorityTier,
  reason: string,
): ExtractedEntityHintDraft[] {
  const out: ExtractedEntityHintDraft[] = [];
  const regex = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    let name = m[1]?.trim();
    if (!name) {
      continue;
    }
    if (entityType === "ORGANIZATION" || entityType === "COMPANY" || entityType === "LAB") {
      name = normalizeOrgExtract(name);
    }
    out.push({
      name,
      entityType,
      confidence: clampConfidence(baseConfidence, tier),
      reason,
      sourceTextSnippet: m[0].slice(0, 120),
      evidenceJson: {
        extractionMethod: "rule",
        ruleId,
      },
    });
  }
  return out;
}

function extractRules(input: SignalExtractionInput): ExtractedEntityHintDraft[] {
  const text = combinedText(input);
  const tier = input.sourceAuthorityTier ?? "unknown";
  const isScan = isWebsiteScanSignal(input);
  const scanOpts = { isWebsiteScan: isScan };
  const out: ExtractedEntityHintDraft[] = [];
  const seen = new Set<string>();

  if (input.guessedProjectName?.trim() && !isScan) {
    pushUnique(
      out,
      seen,
      {
        name: input.guessedProjectName.trim(),
        entityType: "PROJECT",
        confidence: clampConfidence(0.68, tier),
        reason: "Signal 已猜测项目名称",
        evidenceJson: { extractionMethod: "signal_field", ruleId: "guessedProjectName" },
      },
      scanOpts,
    );
  }

  if (input.guessedGithubUrl?.trim() && !isScan) {
    const repoMatch = input.guessedGithubUrl.match(/github\.com\/[^/]+\/([^/?#]+)/i);
    if (repoMatch?.[1]) {
      pushUnique(
        out,
        seen,
        {
          name: repoMatch[1],
          entityType: "PROJECT",
          confidence: clampConfidence(0.55, tier),
          reason: "Signal 关联 GitHub 仓库名",
          evidenceJson: { extractionMethod: "signal_field", ruleId: "guessedGithubUrl" },
        },
        scanOpts,
      );
    }
  }

  const labBase = isScan ? 0.78 : 0.72;
  const orgBase = isScan ? 0.78 : 0.7;
  const companyBase = isScan ? 0.76 : 0.65;

  for (const draft of extractByRegex(
    text,
    LAB_SUFFIX,
    "LAB",
    "lab_suffix",
    labBase,
    tier,
    "实验室/研究中心名称模式",
  )) {
    pushUnique(out, seen, draft, scanOpts);
  }

  for (const draft of extractByRegex(
    text,
    ORG_SUFFIX,
    "ORGANIZATION",
    "org_suffix",
    orgBase,
    tier,
    "机构/协会/出版社名称模式",
  )) {
    pushUnique(out, seen, draft, scanOpts);
  }

  for (const draft of extractByRegex(
    text,
    COMPANY_SUFFIX,
    "COMPANY",
    "company_suffix",
    companyBase,
    tier,
    "公司名称模式",
  )) {
    pushUnique(out, seen, draft, scanOpts);
  }

  for (const draft of extractAwardProjectRows(text, tier)) {
    pushUnique(out, seen, draft, scanOpts);
  }

  for (const draft of extractKnownPublishingOrganizations(text, tier)) {
    pushUnique(out, seen, draft, scanOpts);
  }

  if (!isScan) {
    for (const draft of extractByRegex(
      text,
      EVENT_SUFFIX,
      "EVENT",
      "event_suffix",
      0.6,
      tier,
      "会议/论坛名称模式",
    )) {
      pushUnique(out, seen, draft, scanOpts);
    }

    for (const name of extractQuotedNames(text)) {
      pushUnique(
        out,
        seen,
        {
          name,
          entityType: inferTypeFromName(name),
          confidence: clampConfidence(0.58, tier),
          reason: "引号/书名号中的实体名称",
          evidenceJson: { extractionMethod: "rule", ruleId: "quoted_name" },
        },
        scanOpts,
      );
    }

    for (const name of extractListNames(text)) {
      pushUnique(
        out,
        seen,
        {
          name,
          entityType: inferTypeFromName(name),
          confidence: clampConfidence(0.66, tier),
          reason: "名单/公告列表项",
          evidenceJson: { extractionMethod: "rule", ruleId: "list_item" },
        },
        scanOpts,
      );
    }

    for (const draft of extractLaunchProducts(text, tier)) {
      pushUnique(out, seen, draft, scanOpts);
    }
  }

  for (const draft of out) {
    draft.evidenceJson = {
      ...draft.evidenceJson,
      sourceAuthorityTier: tier,
      signalType: input.signalType,
      sourceType: input.sourceType,
    };
  }

  return out;
}

function inferTypeFromName(name: string): string {
  if (/(数据集|数据资源|语料|语料库|benchmark|dataset)/i.test(name)) {
    return "DATASET";
  }
  if (/(方法|机制|框架|范式)$/.test(name)) {
    return "METHOD";
  }
  if (/(概念|理论)$/.test(name)) {
    return "CONCEPT";
  }
  if (/(模型|大模型|model)/i.test(name)) {
    return "MODEL";
  }
  if (/(平台|系统|项目|工程|建设|应用|服务|软件|中心|云|库)/.test(name)) {
    return "PROJECT";
  }
  if (/(实验室|研究中心|研究院)/.test(name)) {
    return "LAB";
  }
  if (/(协会|学会|出版社|局|署)/.test(name)) {
    return "ORGANIZATION";
  }
  if (/(有限公司|股份公司|集团)/.test(name)) {
    return "COMPANY";
  }
  if (/(论坛|峰会|大会|会议)/.test(name)) {
    return "EVENT";
  }
  if (/(平台|中台)/.test(name)) {
    return "PLATFORM";
  }
  if (/(工具|引擎|助手)/.test(name)) {
    return "TOOL";
  }
  if (/(数据集|语料|benchmark)/i.test(name)) {
    return "DATASET";
  }
  return "PROJECT";
}

async function extractWithAi(input: SignalExtractionInput): Promise<ExtractedEntityHintDraft[]> {
  if (isWebsiteScanSignal(input)) {
    return [];
  }
  try {
    const { generateText } = await import("@/lib/ai/generate-text");
    const { getResolvedAiConfig } = await import("@/lib/ai/ai-config");
    const text = combinedText(input).slice(0, 5000);
    if (!text.trim()) {
      return [];
    }

    const prompt = `你是出版与 AI 行业的实体识别助手。从以下信号文本中抽取可能存在的实体线索。
不要求每个实体都有官网或 GitHub；允许信息不完整。

信号标题：${input.title}
信号类型：${input.signalType}
来源类型：${input.sourceType}
来源名称：${input.sourceName}
原文 URL：${input.url}

正文：
${text}

请识别所有可能的实体，类型只能是：PROJECT, ORGANIZATION, LAB, TOOL, PLATFORM, COMPANY, DATASET, EVENT。
优先抽取：机构名、实验室名、产品/工具名、平台名、公司名、会议名。
忽略纯动作词、日期、无意义片段。

只返回 JSON 数组，每项字段：
- name (string, 必填)
- entityType (string)
- confidence (0-1 number)
- reason (string, 简短中文)
- snippet (string, 原文片段, 可选)

找不到实体返回 []。`;

    const raw = await generateText(prompt, {
      maxTokens: 1200,
      temperature: 0.15,
      systemPrompt: "你是实体抽取专家，只返回 JSON 数组，不要其他内容。",
    });

    const jsonStr = raw.match(/\[[\s\S]*\]/)?.[0];
    if (!jsonStr) {
      return [];
    }

    const parsed = JSON.parse(jsonStr) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    const cfg = getResolvedAiConfig();
    const tier = input.sourceAuthorityTier ?? "unknown";

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => {
        const name = typeof item.name === "string" ? item.name.trim() : "";
        const entityType =
          typeof item.entityType === "string" ? item.entityType.trim().toUpperCase() : "PROJECT";
        const confidenceRaw = typeof item.confidence === "number" ? item.confidence : 0.55;
        const reason =
          typeof item.reason === "string" && item.reason.trim()
            ? item.reason.trim()
            : "AI 实体抽取";
        const snippet =
          typeof item.snippet === "string" ? item.snippet.slice(0, 200) : undefined;
        return {
          name,
          entityType,
          confidence: clampConfidence(confidenceRaw, tier),
          reason,
          sourceTextSnippet: snippet,
          evidenceJson: {
            extractionMethod: "ai" as const,
            aiModel: cfg.model,
            sourceAuthorityTier: tier,
            signalType: input.signalType,
            sourceType: input.sourceType,
          },
        };
      })
      .filter((d) => isValidEntityName(d.name, { isWebsiteScan: isWebsiteScanSignal(input) }));
  } catch {
    return [];
  }
}

export async function extractEntityHintsFromSignal(
  input: SignalExtractionInput,
): Promise<EntityHintExtractionResult> {
  const isScan = isWebsiteScanSignal(input);
  const judgeEnabled =
    input.useAi !== false &&
    !input.noAiJudge &&
    (isScan || input.useAiJudge === true);

  if (judgeEnabled) {
    const judgeResult = await runAiEntityJudge({
      title: input.title,
      summary: input.summary,
      rawText: input.rawText,
      url: input.url,
      signalType: input.signalType,
      sourceType: input.sourceType,
      sourceName: input.sourceName,
      discoveryScopes: input.discoveryScopes,
      sourceAuthorityTier: input.sourceAuthorityTier,
      metadataJson: input.metadataJson,
      minConfidence: input.minConfidence,
      minRelevance: input.minRelevance,
    });

    if (!judgeResult.failed) {
      const drafts = aiJudgedEntitiesToHintDrafts({
        entities: judgeResult.entities,
        input: {
          title: input.title,
          summary: input.summary,
          rawText: input.rawText,
          url: input.url,
          signalType: input.signalType,
          sourceType: input.sourceType,
          sourceName: input.sourceName,
          discoveryScopes: input.discoveryScopes,
          sourceAuthorityTier: input.sourceAuthorityTier,
          metadataJson: input.metadataJson,
        },
        model: judgeResult.model,
      });

      const filtered = filterEntityHintDrafts(drafts, {
        isWebsiteScan: isScan,
        minConfidence: input.minConfidence ?? WEBSITE_SCAN_MIN_CONFIDENCE,
      });

      const skipStats: HintQualitySkipStats = filtered.stats;

      if (filtered.accepted.length === 0) {
        return {
          hints: [],
          skippedReason:
            judgeResult.skippedReason ||
            (skipStats.skippedNavigation + skipStats.skippedGeneric + skipStats.skippedLowQuality > 0
              ? "quality_filtered_after_ai_judge"
              : "ai_judge_no_entities"),
          skipStats,
        };
      }

      return {
        hints: filtered.accepted,
        skippedReason: judgeResult.skippedReason,
        skipStats,
      };
    }
    // 技术失败 → 回退规则抽取
  }

  const ruleHints = extractRules(input);
  const aiHints = input.useAi ? await extractWithAi(input) : [];
  const seen = new Set(ruleHints.map((h) => `${normalizeEntityName(h.name)}:${h.entityType}`));
  const extraAiHints = aiHints.filter((draft) => {
    const key = `${normalizeEntityName(draft.name)}:${draft.entityType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  const rawHints = [...ruleHints, ...extraAiHints];

  const filtered = filterEntityHintDrafts(rawHints, {
    isWebsiteScan: isScan,
    minConfidence: isScan ? WEBSITE_SCAN_MIN_CONFIDENCE : 0,
  });

  const skipStats: HintQualitySkipStats = filtered.stats;

  if (filtered.accepted.length === 0) {
    return {
      hints: [],
      skippedReason: skipStats.skippedNavigation + skipStats.skippedGeneric + skipStats.skippedLowQuality > 0
        ? "quality_filtered"
        : "no_entities_detected",
      skipStats,
    };
  }

  return { hints: filtered.accepted, skipStats };
}

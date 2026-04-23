export type AiContentDraftWorkflowStatus = "drafting" | "reviewing" | "ready_for_publish";

const WORKFLOW_LABEL: Record<AiContentDraftWorkflowStatus, string> = {
  drafting: "草稿中",
  reviewing: "校对中",
  ready_for_publish: "可发布",
};

export function isAiContentDraftWorkflowStatus(value: string | null | undefined): value is AiContentDraftWorkflowStatus {
  return value === "drafting" || value === "reviewing" || value === "ready_for_publish";
}

export function workflowStatusLabel(status: string | null | undefined): string {
  if (status && isAiContentDraftWorkflowStatus(status)) return WORKFLOW_LABEL[status];
  return "未设置";
}

export function userOperatorLabel(
  user: { name: string | null; email: string | null } | null | undefined,
  operatorId: string,
): string {
  if (user?.name?.trim()) return user.name.trim();
  if (user?.email?.trim()) return user.email.trim();
  if (operatorId) return `用户 ${operatorId.slice(0, 8)}…`;
  return "未知用户";
}

function normStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
}

type ContentShape = {
  copy?: Record<string, unknown>;
  poster?: Record<string, unknown>;
  notes?: unknown;
};

function asShape(v: unknown): ContentShape {
  if (!v || typeof v !== "object") return {};
  return v as ContentShape;
}

/**
 * 粗粒度对比 before/after，生成简短中文摘要（不暴露 JSON 原文）。
 */
export function summarizeContentEdit(
  before: unknown,
  after: unknown,
  editKind: string | null | undefined,
): string {
  if (editKind === "reset") return "恢复为 AI 原始版本";

  const b = asShape(before);
  const a = asShape(after);
  const labels: string[] = [];

  const bc = (b.copy ?? {}) as Record<string, unknown>;
  const ac = (a.copy ?? {}) as Record<string, unknown>;
  if (normStr(bc.oneLiner) !== normStr(ac.oneLiner)) labels.push("一句话传播版");
  if (normStr(bc.short) !== normStr(ac.short)) labels.push("短文案");
  if (normStr(bc.medium) !== normStr(ac.medium)) labels.push("中文案");
  if (normStr(bc.long) !== normStr(ac.long)) labels.push("长文案");

  const bav = (bc.audienceVersions ?? {}) as Record<string, unknown>;
  const aav = (ac.audienceVersions ?? {}) as Record<string, unknown>;
  const audKeys = ["general", "business", "creator", "developer"] as const;
  if (audKeys.some((k) => normStr(bav[k]) !== normStr(aav[k]))) labels.push("不同受众文案");

  const bp = (b.poster ?? {}) as Record<string, unknown>;
  const ap = (a.poster ?? {}) as Record<string, unknown>;
  if (normStr(bp.title) !== normStr(ap.title) || normStr(bp.subtitle) !== normStr(ap.subtitle)) {
    labels.push("海报标题与副标题");
  }
  if (JSON.stringify(normArr(bp.highlights)) !== JSON.stringify(normArr(ap.highlights))) labels.push("海报亮点");
  if (normStr(bp.targetUsers) !== normStr(ap.targetUsers)) labels.push("目标用户描述");
  if (normStr(bp.callToAction) !== normStr(ap.callToAction)) labels.push("行动引导");
  if (normStr(bp.contactLine) !== normStr(ap.contactLine)) labels.push("联系方式");
  if (normStr(bp.linkLine) !== normStr(ap.linkLine)) labels.push("链接信息");

  if (JSON.stringify(normArr(b.notes)) !== JSON.stringify(normArr(a.notes))) labels.push("生成说明");

  if (!labels.length) return "更新了传播草稿";

  const head = labels.slice(0, 4);
  const tail = labels.length > 4 ? "等" : "";
  return `更新了${head.join("、")}${tail}`;
}

export function stableSerializeJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = walk(obj[k]);
    }
    return out;
  };
  return JSON.stringify(walk(value));
}

export function contentPayloadEquals(a: unknown, b: unknown): boolean {
  return stableSerializeJson(a) === stableSerializeJson(b);
}

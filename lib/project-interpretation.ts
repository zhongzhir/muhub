/**
 * 项目解读（规则层 V1）：把仓库/动态等「技术事实」转写为非技术用户可读说明。
 * 后续可替换为 LLM 解读、多语言、分人群版本等；对外输出结构保持稳定即可。
 */

import type { ProjectPageView } from "@/lib/demo-project";
import { parseRepoUrl } from "@/lib/repo-platform";

export type ProjectInterpretationItem = {
  id: string;
  label: string;
  detail: string;
  tone?: "neutral" | "positive" | "cautious";
};

export type ProjectInterpretationResult = {
  items: ProjectInterpretationItem[];
  generatedBy: "rules-v1";
};

function hasPublicCodeRepo(data: ProjectPageView): boolean {
  if (parseRepoUrl(data.githubUrl ?? "")) {
    return true;
  }
  return Boolean(data.sources?.some((s) => s.kind === "GITHUB" || s.kind === "GITEE"));
}

function latestUpdateTime(data: ProjectPageView): Date | null {
  let maxMs = 0;
  for (const u of data.updates) {
    const t = (u.occurredAt ?? u.createdAt ?? new Date(0)).getTime();
    if (t > maxMs) {
      maxMs = t;
    }
  }
  return maxMs > 0 ? new Date(maxMs) : null;
}

function latestRepoSignalTime(data: ProjectPageView): Date | null {
  const s = data.githubSnapshot;
  if (!s) {
    return null;
  }
  const candidates = [s.lastCommitAt, s.fetchedAt].filter((d): d is Date => Boolean(d));
  if (!candidates.length) {
    return null;
  }
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

function resolveActivityAnchor(data: ProjectPageView): Date | null {
  const u = latestUpdateTime(data);
  const r = latestRepoSignalTime(data);
  if (u && r) {
    return new Date(Math.max(u.getTime(), r.getTime()));
  }
  return u ?? r;
}

function interpretationHeat(data: ProjectPageView): ProjectInterpretationItem | null {
  const snap = data.githubSnapshot;
  if (!snap) {
    return null;
  }
  const stars = snap.stars;
  if (stars >= 5000) {
    return {
      id: "heat",
      label: "开发者关注度",
      detail:
        "在公开代码平台上，这个仓库收获的星标数量较多。通常可以理解为：已有不少开发者留意或试用过相关内容，但不等同于普通用户规模或商业成绩。",
      tone: "positive",
    };
  }
  if (stars >= 1000) {
    return {
      id: "heat",
      label: "开发者关注度",
      detail:
        "在开发者社区中已有一定关注度。多表示有人持续关注仓库进展，适合作为「口碑参考」之一，仍需结合自己的需求判断。",
      tone: "positive",
    };
  }
  if (stars >= 100) {
    return {
      id: "heat",
      label: "开发者关注度",
      detail:
        "星标数量处于稳步积累阶段，属于常见成长中的开源/开放仓库体量。若你关心社区反馈，可以继续观察后续更新与讨论。",
      tone: "neutral",
    };
  }
  return {
    id: "heat",
    label: "开发者关注度",
    detail:
      "当前星标还不算多，往往对应仍处于早期或小众圈层的阶段。这不代表好坏，只是说明公开关注度尚处在积累期。",
    tone: "cautious",
  };
}

function interpretationActivity(data: ProjectPageView): ProjectInterpretationItem | null {
  const anchor = resolveActivityAnchor(data);
  if (!anchor) {
    return null;
  }
  const days = (Date.now() - anchor.getTime()) / 86400000;
  if (days <= 7) {
    return {
      id: "activity",
      label: "近期活跃度",
      detail:
        "从最近的公开动态或仓库记录看，项目在近期仍有可见更新。通常说明仍在维护或对外同步进展，但不代表具体发布节奏。",
      tone: "positive",
    };
  }
  if (days <= 30) {
    return {
      id: "activity",
      label: "近期活跃度",
      detail:
        "最近一段时间仍能看到更新痕迹。若你在评估是否持续关注，可以隔段时间再看是否有新的说明或版本。",
      tone: "neutral",
    };
  }
  return {
    id: "activity",
    label: "近期活跃度",
    detail:
      "近期公开的可读更新相对较少。这可能与发布节奏、信息是否同步到平台等因素有关，建议结合官网或其他渠道一起看。",
    tone: "cautious",
  };
}

function inferTechItem(data: ProjectPageView): ProjectInterpretationItem | null {
  const blob = [
    ...(data.tags ?? []),
    data.tagline ?? "",
    data.description.slice(0, 400),
  ]
    .join(" ")
    .toLowerCase();

  const web =
    /typescript|javascript|\bnext\.js\b|nextjs|\breact\b|\bvue\b|svelte|webpack|vite|tailwind|前端|网页|web应用|web 应用|网站/.test(
      blob,
    );
  const ai =
    /\bpython\b|pytorch|tensorflow|\bllm\b|大模型|机器学习|深度学习|神经网络|推理|embedding|langchain|提示词|gpt|\bmodel\b|ai工具|人工智能/.test(
      blob,
    );
  const chain =
    /solidity|\beth\b|evm|web3|区块链|智能合约|defi|nft|钱包|链上/.test(blob);
  const mobile =
    /ios|android|flutter|react native|swift|kotlin|移动端|手机应用|小程序/.test(blob);

  if (web && ai) {
    return {
      id: "tech",
      label: "项目类型线索",
      detail:
        "从标签与描述里的技术线索看，它同时带有「网页/在线产品」与「AI 能力相关」的色彩，更像面向线上使用场景、并可能集成智能能力的项目（仅供参考，以官方定位为准）。",
      tone: "neutral",
    };
  }
  if (chain) {
    return {
      id: "tech",
      label: "项目类型线索",
      detail:
        "从关键词偏好看，更接近区块链或链上应用方向。涉及资产与安全时，请务必自行核实官方说明与风险提示。",
      tone: "cautious",
    };
  }
  if (mobile) {
    return {
      id: "tech",
      label: "项目类型线索",
      detail:
        "从现有文字信息推测，更偏向移动端或手持设备上的使用场景。具体是否已有安装包或商店上架，请以官方渠道为准。",
      tone: "neutral",
    };
  }
  if (ai) {
    return {
      id: "tech",
      label: "项目类型线索",
      detail:
        "从标签与技术相关表述看，更接近「AI / 模型 / 数据智能」一类能力型项目；适合关心算法、工具链或自动化的人群了解。",
      tone: "neutral",
    };
  }
  if (web) {
    return {
      id: "tech",
      label: "项目类型线索",
      detail:
        "从技术栈相关线索看，更像面向浏览器或在线访问的产品/工具。最终以团队自述的产品形态为准。",
      tone: "neutral",
    };
  }
  if ((data.tags?.length ?? 0) > 0) {
    const preview = (data.tags ?? []).slice(0, 5).join("、");
    return {
      id: "tech",
      label: "标签线索",
      detail: `页面上标注了「${preview}」等标签，可以帮你快速联想项目可能涉及的领域；具体能力与边界仍以官方介绍为准。`,
      tone: "neutral",
    };
  }
  return null;
}

function interpretationOpenness(data: ProjectPageView): ProjectInterpretationItem | null {
  const hasRepo = hasPublicCodeRepo(data);
  const hasWeb = Boolean(data.websiteUrl?.trim());
  const hasUpdates = data.updates.length > 0;

  if (hasRepo && hasWeb && hasUpdates) {
    return {
      id: "openness",
      label: "公开资料完整度",
      detail:
        "同时具备官网、公开仓库与动态信息，对外材料相对齐全，便于从不同入口了解项目进展（仍建议以官方为准核实关键信息）。",
      tone: "positive",
    };
  }
  if (hasRepo) {
    return {
      id: "openness",
      label: "开放协作",
      detail:
        "提供公开代码仓库，一般意味着愿意让外界查看实现与参与讨论。你可以在遵守许可协议的前提下浏览代码与提交记录。",
      tone: "positive",
    };
  }
  if (hasWeb && !hasRepo) {
    return {
      id: "openness",
      label: "公开资料",
      detail:
        "目前以官网等页面为主；若后续补充仓库链接或项目动态，通常会更容易跟踪版本迭代与社区反馈。",
      tone: "neutral",
    };
  }
  if (!hasWeb && !hasRepo && hasUpdates) {
    return {
      id: "openness",
      label: "公开资料",
      detail:
        "能在这里看到部分动态记录；若再补充官网或仓库入口，读者通常能更系统地了解背景与使用方式。",
      tone: "neutral",
    };
  }
  if (!hasWeb && !hasRepo && !hasUpdates) {
    return {
      id: "openness",
      label: "公开资料",
      detail:
        "当前页面上可核对的信息还比较少。若你感兴趣，可留意后续是否补充官网、仓库或更新说明。",
      tone: "cautious",
    };
  }
  return null;
}

function interpretationStage(data: ProjectPageView): ProjectInterpretationItem | null {
  const snap = data.githubSnapshot;
  const lowStars = snap ? snap.stars < 100 : !hasPublicCodeRepo(data);
  const hasWeb = Boolean(data.websiteUrl?.trim());
  const hasRepo = hasPublicCodeRepo(data);
  const anchor = resolveActivityAnchor(data);
  const days = anchor ? (Date.now() - anchor.getTime()) / 86400000 : 9999;
  const activeComms = data.updates.length >= 3;

  if (lowStars && !hasWeb && data.updates.length < 2) {
    return {
      id: "stage",
      label: "阶段感（粗浅）",
      detail:
        "从公开信息体量看，更接近早期或首发曝光阶段：资料与社区痕迹还不算多，适合保持观察、并直接阅读官方表述。",
      tone: "cautious",
    };
  }
  if (hasWeb && hasRepo && days <= 30) {
    return {
      id: "stage",
      label: "阶段感（粗浅）",
      detail:
        "同时具备官网与仓库，且近期仍有可见更新，从公开渠道看已经具备较完整的自我介绍基础。",
      tone: "neutral",
    };
  }
  if (activeComms) {
    return {
      id: "stage",
      label: "阶段感（粗浅）",
      detail:
        "对外动态条目较多，说明团队较积极在平台上同步进展或想法；仍建议以单条内容的权威性为准交叉核对。",
      tone: "neutral",
    };
  }
  return null;
}

/**
 * 基于详情页已有 `ProjectPageView` 生成解读条目（不访问数据库、不接 LLM）。
 * 仅在具备足够依据时产出对应条目，宁可少写，避免凑数。
 */
export function getProjectInterpretation(data: ProjectPageView): ProjectInterpretationResult {
  const items: ProjectInterpretationItem[] = [];

  const heat = interpretationHeat(data);
  if (heat) {
    items.push(heat);
  }

  const act = interpretationActivity(data);
  if (act) {
    items.push(act);
  }

  const tech = inferTechItem(data);
  if (tech) {
    items.push(tech);
  }

  const open = interpretationOpenness(data);
  if (open) {
    items.push(open);
  }

  const stage = interpretationStage(data);
  if (stage) {
    items.push(stage);
  }

  /** 上限 6 条，保持页面轻量 */
  const capped = items.slice(0, 6);

  return { items: capped, generatedBy: "rules-v1" };
}

type MarketingMode = "social" | "article";

type MarketingPromptInput = {
  project: {
    name: string;
    tagline?: string | null;
    description?: string | null;
    tags?: string[] | null;
  };
  aiInsight?: {
    whatItIs?: string;
    whoFor?: string[] | string;
    useCases?: string[] | string;
    highlights?: string[] | string;
  } | null;
  mode: MarketingMode;
};

function listToText(value: string[] | string | undefined): string {
  if (Array.isArray(value)) return value.filter(Boolean).join("；");
  return value ?? "";
}

export function buildPrompt({
  project,
  aiInsight,
  mode,
}: MarketingPromptInput): string {
  const baseInfo = `
项目名称：${project.name}
一句话简介：${project.tagline || ""}
项目介绍：${project.description || ""}
项目标签：${(project.tags ?? []).join("、")}

AI分析：
- 项目是什么：${aiInsight?.whatItIs || ""}
- 适合谁：${listToText(aiInsight?.whoFor)}
- 使用场景：${listToText(aiInsight?.useCases)}
- 亮点：${listToText(aiInsight?.highlights)}
`;

  if (mode === "social") {
    return `
你正在写一条“推荐项目”的社交媒体文案。

要求：
1. 必须有吸引力（像人在分享）
2. 用自然中文表达，不要像说明书
3. 用“使用场景”来讲清楚价值
4. 不要简单复述原文
5. 控制在120字左右

禁止：
- 编造不存在的信息
- 使用“本项目提供...”这种技术文档语气

${baseInfo}
`;
  }

  return `
你正在写一篇公众号文章，介绍一个值得关注的项目。

目标：
让读者产生兴趣，并理解这个项目的价值。

写作结构：
【标题】
【开头】用场景或问题引入
【项目是什么】用通俗语言解释
【它能做什么（使用场景）】结合真实使用情况说明
【为什么值得关注】总结2-4个亮点
【适合谁】明确人群
【总结】

要求：
- 中文自然表达
- 不要技术说明书语气
- 可以有推荐感，但不能夸张
- 不允许编造信息
- 字数：800-1500字

${baseInfo}
`;
}

type MarketingMode = "social" | "article";
type MarketingTone = "balanced" | "expressive";

type MarketingPromptInput = {
  mode: MarketingMode;
  tone: MarketingTone;
  baseInfo: string;
};

export function buildPrompt({ mode, tone, baseInfo }: MarketingPromptInput): string {
  if (mode === "social") {
    return `
你正在写一条“推荐项目”的社交媒体文案，目标是让用户愿意停下来读完并点开查看。

要求：
1. 第一语句必须有吸引力，像真实用户观察或推荐开场。
2. 必须引入一个“使用场景”或“用户感受”。
3. 不能把“某某是一款...”作为唯一开头方式。
4. 必须写出“为什么值得看一眼”。
5. 正文控制在 80~140 中文字。
6. 语气：${tone === "expressive" ? "强表达，允许更有推荐感" : "平衡表达，克制可靠"}。

禁止：
- README 复述
- 参数堆砌、功能清单堆砌
- 使用“本项目主要提供以下功能”“用户可以通过该项目实现”等文档腔
- 编造输入中不存在的信息

输出格式（严格 JSON）：
{
  "hookLine": "string",
  "content": "string",
  "summaryNotes": ["string"]
}

${baseInfo.trim()}
`;
  }

  return `
你正在写一篇公众号风格文章，介绍一个值得关注的项目。

目标：
让读者有兴趣继续读下去，并理解这个项目的真实价值。

写作结构：
标题

开头：
- 用场景、问题或观察切入

这是什么项目：
- 通俗解释，不要技术文档语气

它适合谁、能解决什么问题：
- 用具体场景来写

为什么值得关注：
- 2~4个亮点，用自然语言拆解

补充信息：
- 开源 / GitHub / 活跃度 / 生态信息（仅在输入存在时提及）

总结：
- 用一句自然中文收束

要求：
- 中文自然表达，像公众号作者在写，不像产品说明书
- 可以有推荐感，但不能夸张，不允许标题党
- 不允许编造信息，不允许照搬原文
- 不要全文变成 1/2/3 机械条列
- 字数：1000~1800 中文字
- 语气：${tone === "expressive" ? "强表达，增强叙事感染力" : "平衡表达，稳妥可信"}。

输出格式（严格 JSON）：
{
  "titleCandidates": ["string", "string", "string"],
  "content": "string",
  "summaryNotes": ["string"]
}

${baseInfo.trim()}
`;
}

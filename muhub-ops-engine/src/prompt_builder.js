function formatHighlights(highlights) {
  if (!Array.isArray(highlights) || highlights.length === 0) {
    return "暂无";
  }
  return highlights.slice(0, 4).join(" / ");
}

function buildWechatPrompt(projects) {
  const safeProjects = Array.isArray(projects) ? projects : [];

  const projectBlocks = safeProjects.map((project, idx) => {
    const name = project.name || `未命名项目-${idx + 1}`;
    const summary = project.summary || "暂无摘要";
    const highlights = formatHighlights(project.highlights);
    const activity =
      project.latestActivity && (project.latestActivity.title || project.latestActivity.type)
        ? `${project.latestActivity.type || "activity"}: ${project.latestActivity.title || "有更新"}`
        : "暂无最新动态";
    const url = project.url || "暂无链接";

    return [
      `项目 ${idx + 1}`,
      `- 名称：${name}`,
      `- 摘要：${summary}`,
      `- 标签：${highlights}`,
      `- 最新动态：${activity}`,
      `- 链接：${url}`
    ].join("\n");
  });

  return [
    "请基于以下 MUHUB 项目信息，生成一篇公众号“项目推荐合集”草稿。",
    "",
    "写作要求：",
    "1) 标题 + 导语 + 项目分节 + 结尾链接区，结构清晰。",
    "2) 每个项目一小节，包含项目简介、亮点、近期动态（如无则自然略过）、推荐理由。",
    "3) 语气专业克制，像分享发现，不像广告。",
    "4) 输出 Markdown 格式。",
    "",
    "项目数据：",
    projectBlocks.join("\n\n"),
    "",
    "结尾请保留项目链接列表（每个项目一行，格式：项目名 - 链接）。"
  ].join("\n");
}

function buildXPrompt(project) {
  const safeProject = project && typeof project === "object" ? project : {};
  const name = safeProject.name || "未命名项目";
  const summary = safeProject.summary || "暂无摘要";
  const highlights = formatHighlights(safeProject.highlights);
  const activity =
    safeProject.latestActivity && (safeProject.latestActivity.title || safeProject.latestActivity.type)
      ? `${safeProject.latestActivity.type || "activity"}: ${safeProject.latestActivity.title || "有更新"}`
      : "暂无最新动态";
  const url = safeProject.url || "暂无链接";

  return [
    "请写一条适合发布在 X 的短帖（中文）。",
    "",
    "要求：",
    "1) 简洁，不夸张，不广告腔。",
    "2) 像在分享最近发现的好项目。",
    "3) 可以带 1-2 个标签（可选）。",
    "4) 保留项目链接。",
    "",
    "项目信息：",
    `- 名称：${name}`,
    `- 摘要：${summary}`,
    `- 标签：${highlights}`,
    `- 最新动态：${activity}`,
    `- 链接：${url}`
  ].join("\n");
}

module.exports = {
  buildWechatPrompt,
  buildXPrompt
};

const fs = require("fs");
const path = require("path");
const { selectProjectsForWechat } = require("../src/project_selector");
const { buildWechatPrompt } = require("../src/prompt_builder");
const { generateText } = require("../src/llm_client");
const { writeWechatPost } = require("../src/file_writer");

function loadProjects() {
  const inputPath = path.resolve(__dirname, "..", "inputs", "projects.json");
  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

async function main() {
  const projects = loadProjects();
  const selected = selectProjectsForWechat(projects, 3);

  if (selected.length === 0) {
    throw new Error("inputs/projects.json 中没有可用项目数据");
  }

  const prompt = buildWechatPrompt(selected);
  const result = await generateText(prompt, {
    channel: "wechat",
    filePrefix: "wechat-post"
  });

  const outputPath = writeWechatPost(result.text);
  const summary = {
    type: "wechat",
    selectedCount: selected.length,
    outputPath,
    fallback: result.fallback,
    draftPath: result.draftPath,
    reason: result.reason
  };

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[generate_wechat_post] failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  main
};

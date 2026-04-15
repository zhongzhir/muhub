const fs = require("fs");
const path = require("path");
const { selectProjectsForX } = require("../src/project_selector");
const { buildXPrompt } = require("../src/prompt_builder");
const { generateText } = require("../src/llm_client");
const { writeXPost } = require("../src/file_writer");

function loadProjects() {
  const inputPath = path.resolve(__dirname, "..", "inputs", "projects.json");
  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

async function main() {
  const projects = loadProjects();
  const selected = selectProjectsForX(projects, 5);

  if (selected.length === 0) {
    throw new Error("inputs/projects.json 中没有可用项目数据");
  }

  const outputs = [];

  for (let i = 0; i < selected.length; i += 1) {
    const project = selected[i];
    const prompt = buildXPrompt(project);
    const slug = project.slug || `project-${i + 1}`;
    const result = await generateText(prompt, {
      channel: "x",
      filePrefix: `x-post-${slug}`
    });
    const outputPath = writeXPost(slug, result.text);

    outputs.push({
      slug,
      outputPath,
      fallback: result.fallback,
      draftPath: result.draftPath,
      reason: result.reason
    });
  }

  const summary = {
    type: "x",
    selectedCount: selected.length,
    generatedCount: outputs.length,
    outputs
  };

  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[generate_x_posts] failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  main
};

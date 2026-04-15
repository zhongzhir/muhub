const { main: runWechat } = require("./generate_wechat_post");
const { main: runXPosts } = require("./generate_x_posts");

async function main() {
  const startedAt = new Date().toISOString();
  const wechat = await runWechat();
  const x = await runXPosts();
  const finishedAt = new Date().toISOString();

  const summary = {
    startedAt,
    finishedAt,
    wechat: {
      outputPath: wechat.outputPath,
      fallback: wechat.fallback,
      draftPath: wechat.draftPath
    },
    x: {
      generatedCount: x.generatedCount,
      fallbackCount: x.outputs.filter((item) => item.fallback).length,
      outputPaths: x.outputs.map((item) => item.outputPath)
    }
  };

  console.log("=== Content Pipeline Summary ===");
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[run_content_pipeline] failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  main
};

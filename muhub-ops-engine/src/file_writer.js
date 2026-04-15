const fs = require("fs");
const path = require("path");

const OUTPUT_ROOT = path.resolve(__dirname, "..", "outputs");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const DD = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${YYYY}${MM}${DD}-${hh}${mm}${ss}`;
}

function sanitizeFileToken(token) {
  return String(token || "untitled").replace(/[^a-zA-Z0-9-_]/g, "-");
}

function writeMarkdown(channelDir, filePrefix, content) {
  const targetDir = path.join(OUTPUT_ROOT, channelDir);
  ensureDir(targetDir);

  const timestamp = getTimestamp();
  const filename = `${sanitizeFileToken(filePrefix)}-${timestamp}.md`;
  const fullPath = path.join(targetDir, filename);

  fs.writeFileSync(fullPath, content || "", "utf8");
  return fullPath;
}

function writeWechatPost(content) {
  return writeMarkdown("wechat", "wechat-post", content);
}

function writeXPost(slug, content) {
  return writeMarkdown("x", `x-post-${sanitizeFileToken(slug)}`, content);
}

function writeDraftPrompt(channel, filePrefix, prompt) {
  const channelName = sanitizeFileToken(channel || "draft");
  return writeMarkdown("drafts", `${channelName}-${filePrefix || "prompt"}`, prompt);
}

module.exports = {
  ensureDir,
  writeWechatPost,
  writeXPost,
  writeDraftPrompt
};

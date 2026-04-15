const dotenv = require("dotenv");
const OpenAI = require("openai");
const { writeDraftPrompt } = require("./file_writer");

dotenv.config({ path: ".env" });

function getClientConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  return { apiKey, baseURL, model };
}

async function generateText(prompt, options = {}) {
  const { apiKey, baseURL, model } = getClientConfig();
  const channel = options.channel || "general";
  const filePrefix = options.filePrefix || "draft";
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 30000;

  if (!apiKey) {
    const draftPath = writeDraftPrompt(channel, filePrefix, prompt);
    return {
      text: prompt,
      fallback: true,
      reason: "OPENAI_API_KEY 缺失，已输出 prompt 草稿",
      draftPath
    };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: baseURL || undefined
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      },
      { signal: controller.signal }
    );

    clearTimeout(timer);

    const text = response?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("模型返回内容为空");
    }

    return {
      text,
      fallback: false,
      reason: null,
      draftPath: null
    };
  } catch (error) {
    clearTimeout(timer);
    const draftPath = writeDraftPrompt(channel, filePrefix, prompt);

    return {
      text: prompt,
      fallback: true,
      reason: `LLM 调用失败，已降级为 prompt 草稿：${error.message}`,
      draftPath
    };
  }
}

module.exports = {
  generateText
};

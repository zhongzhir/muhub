import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getDeepSeekClient() {
  if (_client) return _client;

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  _client = new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com",
  });
  return _client;
}

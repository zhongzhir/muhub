import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getDeepSeekClient() {
  if (_client) return _client;

  const deepSeekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const genericApiKey = process.env.AI_API_KEY?.trim();
  const apiKey = deepSeekApiKey || genericApiKey;
  if (!apiKey) {
    throw new Error("Missing AI_API_KEY");
  }

  const baseURL = deepSeekApiKey
    ? process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com"
    : process.env.AI_BASE_URL?.trim() || undefined;

  _client = new OpenAI(baseURL ? { apiKey, baseURL } : { apiKey });
  return _client;
}

export function getDeepSeekCompatibleModel(envName: string, fallbackDeepSeekModel = "deepseek-chat") {
  const specificModel = process.env[envName]?.trim();
  if (specificModel) {
    return specificModel;
  }
  if (process.env.DEEPSEEK_API_KEY?.trim()) {
    return process.env.DEEPSEEK_MODEL?.trim() || fallbackDeepSeekModel;
  }
  const aiBaseUrl = process.env.AI_BASE_URL?.trim().toLowerCase() || "";
  if (aiBaseUrl.includes("deepseek")) {
    return process.env.AI_MODEL?.trim() || fallbackDeepSeekModel;
  }
  return process.env.AI_MODEL?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

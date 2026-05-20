import OpenAI from "openai";

import { getResolvedAiConfig } from "@/lib/ai/ai-config";

let _client: OpenAI | null = null;

export function getDeepSeekClient() {
  if (_client) return _client;

  const config = getResolvedAiConfig();
  _client = config.baseUrl
    ? new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl })
    : new OpenAI({ apiKey: config.apiKey });
  return _client;
}

export function getDeepSeekCompatibleModel(envName: string, fallbackDeepSeekModel = "deepseek-chat") {
  const specificModel = process.env[envName]?.trim();
  if (specificModel) {
    return specificModel;
  }
  try {
    return getResolvedAiConfig().model;
  } catch {
    return fallbackDeepSeekModel;
  }
}

/**
 * Minimal LLM runtime config. Supports the generic AI_* variables and the
 * existing DeepSeek-specific variables used by project insight generation.
 */

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiConfigError"
  }
}

export type ResolvedAiConfig = {
  /** OpenAI-compatible chat completions provider. */
  provider: string
  model: string
  apiKey: string
  /** Optional base URL without the trailing /chat/completions path. */
  baseUrl?: string
}

/**
 * Resolve AI_PROVIDER / AI_MODEL / AI_API_KEY with DeepSeek fallbacks.
 *
 * Fallback order:
 * - apiKey: AI_API_KEY -> DEEPSEEK_API_KEY
 * - model: AI_MODEL -> DEEPSEEK_MODEL_INSIGHT -> DEEPSEEK_MODEL
 * - baseUrl: AI_BASE_URL -> DEEPSEEK_BASE_URL -> https://api.deepseek.com
 */
export function getResolvedAiConfig(): ResolvedAiConfig {
  const genericApiKey = process.env.AI_API_KEY?.trim()
  const deepSeekApiKey = process.env.DEEPSEEK_API_KEY?.trim()
  const apiKey = genericApiKey || deepSeekApiKey

  const provider = process.env.AI_PROVIDER?.trim() || "openai"
  const model =
    process.env.AI_MODEL?.trim() ||
    process.env.DEEPSEEK_MODEL_INSIGHT?.trim() ||
    process.env.DEEPSEEK_MODEL?.trim() ||
    (deepSeekApiKey ? "deepseek-chat" : "")
  const baseUrl =
    process.env.AI_BASE_URL?.trim() ||
    (deepSeekApiKey
      ? process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com"
      : undefined)

  if (!provider) {
    throw new AiConfigError("缺少环境变量 AI_PROVIDER。")
  }
  if (!model) {
    throw new AiConfigError("缺少环境变量 AI_MODEL 或 DEEPSEEK_MODEL_INSIGHT。")
  }
  if (!apiKey) {
    throw new AiConfigError("缺少环境变量 AI_API_KEY 或 DEEPSEEK_API_KEY。")
  }

  return {
    provider,
    model,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  }
}

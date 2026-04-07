/**
 * 最小 LLM 环境配置：统一从环境变量读取，缺省时由调用方处理错误。
 */

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiConfigError"
  }
}

export type ResolvedAiConfig = {
  /** 例如 openai（OpenAI Chat Completions 兼容端点） */
  provider: string
  model: string
  apiKey: string
  /** 可选覆盖；默认 https://api.openai.com/v1/chat/completions */
  baseUrl?: string
}

/**
 * 读取并校验 AI_PROVIDER / AI_MODEL / AI_API_KEY。
 * 可选：AI_BASE_URL（OpenAI 兼容网关）。
 */
export function getResolvedAiConfig(): ResolvedAiConfig {
  const provider = process.env.AI_PROVIDER?.trim()
  const model = process.env.AI_MODEL?.trim()
  const apiKey = process.env.AI_API_KEY?.trim()
  const baseUrl = process.env.AI_BASE_URL?.trim()

  if (!provider) {
    throw new AiConfigError("缺少环境变量 AI_PROVIDER。")
  }
  if (!model) {
    throw new AiConfigError("缺少环境变量 AI_MODEL。")
  }
  if (!apiKey) {
    throw new AiConfigError("缺少环境变量 AI_API_KEY。")
  }

  return {
    provider,
    model,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  }
}

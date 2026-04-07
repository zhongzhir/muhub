/**
 * 最小可扩展文本生成入口：当前实现 OpenAI Chat Completions 兼容协议。
 * 不绑定业务域；缺配置时抛 AiConfigError。
 */

import type { ResolvedAiConfig } from "./ai-config"
import { getResolvedAiConfig } from "./ai-config"

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

export type GenerateTextOptions = {
  maxTokens?: number
  temperature?: number
  /** 可选 system 提示，偏工具向；默认简短中立说明 */
  systemPrompt?: string
}

export class AiGenerateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiGenerateError"
  }
}

async function openAiCompatibleChat(
  cfg: ResolvedAiConfig,
  prompt: string,
  opts: GenerateTextOptions,
): Promise<string> {
  const endpoint = cfg.baseUrl
    ? `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`
    : "https://api.openai.com/v1/chat/completions"

  const system =
    opts.systemPrompt?.trim() ||
    "You are a helpful assistant. Respond concisely and factually. Do not provide investment advice."

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: opts.maxTokens ?? 512,
      temperature: opts.temperature ?? 0.3,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new AiGenerateError(
      `LLM HTTP ${res.status}: ${errText.slice(0, 500) || res.statusText}`,
    )
  }

  const data: unknown = await res.json()
  const dataObj = data as ChatCompletionResponse
  const choice = dataObj.choices?.[0]
  const text = choice?.message?.content
  if (typeof text !== "string" || !text.trim()) {
    throw new AiGenerateError("LLM 返回中无有效文本内容。")
  }

  return text.trim()
}

/**
 * 统一文本生成入口；扩展其他 provider 时可在此分派。
 */
export async function generateText(
  prompt: string,
  options?: GenerateTextOptions,
): Promise<string> {
  if (!prompt?.trim()) {
    throw new AiGenerateError("prompt 不能为空。")
  }
  const cfg = getResolvedAiConfig()
  const p = cfg.provider.toLowerCase()
  if (p === "openai") {
    return openAiCompatibleChat(cfg, prompt, options ?? {})
  }
  throw new AiGenerateError(`不支持的 AI_PROVIDER: ${cfg.provider}（V1 请使用 openai）`)
}

export type { ResolvedAiConfig } from "./ai-config"
export { AiConfigError, getResolvedAiConfig } from "./ai-config"

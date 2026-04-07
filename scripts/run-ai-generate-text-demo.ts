/**
 * 最小 LLM 适配层验证：配置 AI_PROVIDER=openai、AI_MODEL、AI_API_KEY 后运行。
 *
 * 用法：
 *   pnpm ai:text-demo
 *   pnpm ai:text-demo -- "自定义 prompt"
 *
 * 可选：AI_BASE_URL=https://api.example.com/v1（OpenAI 兼容网关，不含末尾 chat/completions）
 */

import { AiConfigError, generateText } from "../lib/ai/generate-text"

async function main() {
  const argv = process.argv.slice(2)
  const dbl = argv.indexOf("--")
  const promptFromArg =
    dbl >= 0 ? argv.slice(dbl + 1).join(" ").trim() : argv.join(" ").trim() || undefined
  const prompt = promptFromArg || "用一两句中文说明「内容运营里做外发帖前先人工复核」的原因，不展开。"

  try {
    const out = await generateText(prompt, { maxTokens: 256, temperature: 0.2 })
    console.log("[ai:text-demo] OK\n")
    console.log(out)
  } catch (e) {
    if (e instanceof AiConfigError) {
      console.error("[ai:text-demo] 配置错误:", e.message)
      console.error("请设置 AI_PROVIDER=openai、AI_MODEL、AI_API_KEY（可选 AI_BASE_URL）。")
      process.exit(1)
    }
    throw e
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

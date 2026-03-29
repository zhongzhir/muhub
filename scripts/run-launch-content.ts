/**
 * 冷启动内容行动：生成首批 Launch Plan 资产包并落盘。
 * 运行：pnpm growth:launch
 */

import { appendBundle } from "../agents/growth/content-bundle-store"
import { generateInitialLaunchPlan } from "../agents/growth/launch-plan"

async function main() {
  const { bundles } = await generateInitialLaunchPlan()
  for (const b of bundles) {
    await appendBundle(b)
    console.log("[growth] bundle created:", b.title)
  }
  console.log("[growth] done")
}

main().catch((e) => {
  console.error("[growth] launch failed", e)
  process.exitCode = 1
})

/**
 * Content Analytics Agent V1 演示：聚合当前数据源 → 打印 → 写入 data/content-analytics.json。
 *
 * 运行：pnpm content:analytics
 */

import { buildContentAnalyticsSnapshot } from "../agents/content/analytics-agent"
import { upsertLatestContentAnalyticsSnapshot } from "../agents/content/analytics-store"
import { prisma } from "../lib/prisma"

async function main() {
  const snapshot = await buildContentAnalyticsSnapshot()
  console.log("[content-analytics-demo] snapshot:\n")
  console.log(JSON.stringify(snapshot, null, 2))
  await upsertLatestContentAnalyticsSnapshot(snapshot)
  console.log("\n[content-analytics-demo] wrote data/content-analytics.json (latest + history)")
  await prisma.$disconnect().catch(() => {})
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

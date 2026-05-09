/**
 * 项目官方信息全网追踪脚本
 *
 * 功能：
 * 对已上架项目进行官方信息来源的定期追踪和补全，包括：
 * - 官网、微信公众号、微博、抖音、App Store、Google Play 等
 * - 发现新来源时写入项目动态（审核后可发布）
 *
 * 建议运行频率：每周或每两周一次
 * 运行命令：pnpm run tracker:official-info
 *
 * 环境变量：
 * - DATABASE_URL（必须）
 * - OPENAI_API_KEY（必须，用于 AI 信息推断）
 */

import { trackAllProjectsOfficialInfo } from "@/lib/project-tracker/track-official-info";

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[tracker:official-info] 未设置 DATABASE_URL，请在 .env 中配置。");
    process.exit(1);
  }

  const limit = process.env.TRACKER_LIMIT ? parseInt(process.env.TRACKER_LIMIT, 10) : 50;
  const spacingMs = process.env.TRACKER_SPACING_MS ? parseInt(process.env.TRACKER_SPACING_MS, 10) : 800;

  console.log(`[tracker:official-info] 启动，最多处理 ${limit} 个项目，间隔 ${spacingMs}ms`);
  console.log(`[tracker:official-info] 开始时间: ${new Date().toISOString()}\n`);

  const result = await trackAllProjectsOfficialInfo({
    limit,
    onlyMissingSource: true,
    spacingMs,
  });

  console.log("\n========== 追踪完成 ==========");
  console.log(`检查项目数: ${result.examined}`);
  console.log(`已更新:     ${result.updated}`);
  console.log(`已跳过:     ${result.skipped}`);
  console.log(`错误数:     ${result.errors.length}`);

  if (result.updated > 0) {
    console.log("\n有信息缺口的项目列表（前20）：");
    for (const gap of result.gaps.slice(0, 20)) {
      console.log(`  - ${gap.name} (${gap.slug}): 缺少 ${gap.missingFields.join(", ")}`);
    }
  }

  if (result.errors.length > 0) {
    console.warn("\n错误详情：");
    for (const err of result.errors) {
      console.warn(`  ! ${err}`);
    }
  }

  console.log(`\n[tracker:official-info] 结束时间: ${new Date().toISOString()}`);
  process.exit(0);
}

void main();

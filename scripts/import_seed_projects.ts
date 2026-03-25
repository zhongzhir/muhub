/**
 * 冷启动：从 data/seed-projects.json 批量写入 Project（可重复执行，已存在 slug 则跳过）。
 *
 * 运行：pnpm import:seed（需 DATABASE_URL，建议 Node 20+ 与 --env-file=.env）
 */

import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { normalizeRepoWebUrl, parseRepoUrl } from "@/lib/repo-platform";

type SeedRow = {
  name: string;
  slug: string;
  tagline: string;
  repoUrl: string;
  websiteUrl?: string;
  description?: string;
  isFeatured?: boolean;
  sourcePlatform?: string;
  sourceType?: string;
};

function loadSeed(): SeedRow[] {
  const filePath = join(process.cwd(), "data", "seed-projects.json");
  const raw = readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("seed-projects.json 顶层必须是数组");
  }
  return data as SeedRow[];
}

function normalizeOptionalWebsite(raw: string | undefined): string | null {
  const t = raw?.trim();
  if (!t) {
    return null;
  }
  try {
    return new URL(t).href;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[import:seed] 未设置 DATABASE_URL，请配置 .env 或使用：node --env-file=.env …");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  let success = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const rows = loadSeed();
    console.log(`[import:seed] 读取 ${rows.length} 条种子记录\n`);

    for (const row of rows) {
      const slug = typeof row.slug === "string" ? row.slug.trim() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const tagline = typeof row.tagline === "string" ? row.tagline.trim() : "";
      const repoUrlRaw = typeof row.repoUrl === "string" ? row.repoUrl.trim() : "";

      if (!slug || !name || !tagline) {
        console.warn(`[跳过] slug=${slug || "(空)"}：缺少 name / slug / tagline`);
        skipped += 1;
        continue;
      }

      const parsed = parseRepoUrl(repoUrlRaw);
      if (!parsed) {
        console.warn(`[跳过] slug=${slug}：无法解析 repoUrl「${repoUrlRaw}」（仅支持 GitHub / Gitee）`);
        skipped += 1;
        continue;
      }

      const canonicalRepoUrl = normalizeRepoWebUrl(repoUrlRaw);
      if (!canonicalRepoUrl) {
        console.warn(`[跳过] slug=${slug}：规范化 repoUrl 失败`);
        skipped += 1;
        continue;
      }

      const existing = await prisma.project.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (existing) {
        console.log(`[跳过] slug=${slug}：已存在同 slug 项目`);
        skipped += 1;
        continue;
      }

      const websiteUrl = normalizeOptionalWebsite(row.websiteUrl);
      if (row.websiteUrl?.trim() && !websiteUrl) {
        console.warn(`[警告] slug=${slug}：websiteUrl 无效，将置空`);
      }

      const description =
        typeof row.description === "string" && row.description.trim()
          ? row.description.trim()
          : "";
      const isFeatured = Boolean(row.isFeatured);
      const sourceType =
        typeof row.sourceType === "string" && row.sourceType.trim()
          ? row.sourceType.trim()
          : "seed";

      try {
        await prisma.project.create({
          data: {
            slug,
            name,
            tagline,
            description: description || null,
            websiteUrl,
            githubUrl: canonicalRepoUrl,
            isFeatured,
            sourceType,
            status: "ACTIVE",
            isPublic: true,
            claimStatus: "UNCLAIMED",
          },
        });
        console.log(`[成功] ${slug}（${parsed.platform}：${parsed.owner}/${parsed.repo}）`);
        success += 1;
      } catch (e) {
        console.error(`[失败] slug=${slug}：`, e);
        failed += 1;
      }
    }
  } catch (e) {
    console.error("[import:seed] 致命错误：", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n[import:seed] 统计：成功 ${success}，跳过 ${skipped}，失败 ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();

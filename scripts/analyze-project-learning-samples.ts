import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

type CountMap = Record<string, number>;

function bump(map: CountMap, key: string | null | undefined): void {
  const normalized = key?.trim() || "unknown";
  map[normalized] = (map[normalized] ?? 0) + 1;
}

function top(map: CountMap, limit = 30): Array<{ label: string; count: number }> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function hasUrlKind(url: string | null | undefined, kind: "github" | "huggingface" | "wechat" | "docs" | "website"): boolean {
  if (!url) {
    return false;
  }
  const lower = url.toLowerCase();
  if (kind === "github") {
    return lower.includes("github.com/");
  }
  if (kind === "huggingface") {
    return lower.includes("huggingface.co/");
  }
  if (kind === "wechat") {
    return lower.includes("mp.weixin.qq.com/");
  }
  if (kind === "docs") {
    return lower.includes("/docs") || lower.includes("documentation") || lower.includes("docs.");
  }
  return /^https?:\/\//.test(lower);
}

function firstWordPattern(value: string | null | undefined): string {
  const cleaned = value?.trim() ?? "";
  if (!cleaned) {
    return "empty";
  }
  if (/^[A-Z][A-Za-z0-9-]+$/.test(cleaned)) {
    return "single_product_token";
  }
  if (/^[A-Z][A-Za-z0-9-]+ [A-Z]/.test(cleaned)) {
    return "title_case_phrase";
  }
  if (/[\u4e00-\u9fa5]/.test(cleaned)) {
    return "cjk_name";
  }
  return "other";
}

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      OR: [{ visibilityStatus: "PUBLISHED" }, { isPublic: true }],
    },
    take: 5000,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tagline: true,
      tags: true,
      primaryCategory: true,
      categoriesJson: true,
      sourceType: true,
      websiteUrl: true,
      githubUrl: true,
      referenceSources: true,
      aiSourceLevel: true,
      aiKnowledgeJson: true,
      aiStructuredProfileJson: true,
      sources: { select: { kind: true, url: true } },
    },
  });

  const projectTypeDistribution: CountMap = {};
  const tagDistribution: CountMap = {};
  const sourceKindDistribution: CountMap = {};
  const primarySourceDistribution: CountMap = {};
  const namePattern: CountMap = {};
  const taglinePattern: CountMap = {};
  const categoryPattern: CountMap = {};

  let githubCount = 0;
  let websiteCount = 0;
  let huggingfaceCount = 0;
  let wechatCount = 0;
  let docsCount = 0;

  for (const project of projects) {
    bump(projectTypeDistribution, project.primaryCategory ?? project.sourceType);
    bump(namePattern, firstWordPattern(project.name));
    bump(taglinePattern, firstWordPattern(project.tagline));
    if (project.primaryCategory) {
      bump(categoryPattern, project.primaryCategory);
    }
    for (const tag of project.tags ?? []) {
      bump(tagDistribution, tag);
    }
    if (project.githubUrl) {
      githubCount += 1;
      bump(primarySourceDistribution, "github");
    }
    if (project.websiteUrl) {
      websiteCount += 1;
      bump(primarySourceDistribution, "website");
    }
    for (const source of project.sources) {
      bump(sourceKindDistribution, source.kind);
      if (hasUrlKind(source.url, "github")) githubCount += 1;
      if (hasUrlKind(source.url, "huggingface")) huggingfaceCount += 1;
      if (hasUrlKind(source.url, "wechat")) wechatCount += 1;
      if (hasUrlKind(source.url, "docs")) docsCount += 1;
      if (hasUrlKind(source.url, "website")) websiteCount += 1;
    }
  }

  const total = projects.length;
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 1000) / 10 : 0);
  const report = {
    generatedAt: new Date().toISOString(),
    publishedProjectCount: total,
    projectTypeDistribution: top(projectTypeDistribution),
    tagDistribution: top(tagDistribution),
    sourceKindDistribution: top(sourceKindDistribution),
    primarySourceDistribution: top(primarySourceDistribution),
    sourceCoverage: {
      github: { count: githubCount, ratio: pct(githubCount) },
      website: { count: websiteCount, ratio: pct(websiteCount) },
      huggingface: { count: huggingfaceCount, ratio: pct(huggingfaceCount) },
      wechat: { count: wechatCount, ratio: pct(wechatCount) },
      docs: { count: docsCount, ratio: pct(docsCount) },
    },
    namePattern: top(namePattern),
    taglinePattern: top(taglinePattern),
    categoryPattern: top(categoryPattern),
    fieldOriginNotes: {
      official: ["websiteUrl", "githubUrl", "ProjectSource.url"],
      knowledge: ["aiKnowledgeJson", "aiStructuredProfileJson"],
      source: ["referenceSources", "ProjectSource.kind", "ProjectSource.url"],
      legacy: ["sourceType", "aiSourceLevel"],
    },
  };

  const outPath = path.join(process.cwd(), "data", "reports", "project-learning-samples.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, outPath, publishedProjectCount: total }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

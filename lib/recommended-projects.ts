import type { ProjectPageView } from "@/lib/demo-project";

export type RecommendedProject = {
  name: string;
  slug: string;
  tagline: string;
  github: string;
  category: string;
};

export const recommendedProjects: RecommendedProject[] = [
  {
    name: "Vercel",
    slug: "vercel",
    tagline: "Deploy frontend instantly",
    github: "vercel/vercel",
    category: "infra",
  },
  {
    name: "Supabase",
    slug: "supabase",
    tagline: "Open source Firebase alternative",
    github: "supabase/supabase",
    category: "infra",
  },
  {
    name: "LangChain",
    slug: "langchain",
    tagline: "Build LLM applications",
    github: "langchain-ai/langchain",
    category: "ai",
  },
  {
    name: "Next.js",
    slug: "nextjs",
    tagline: "React framework",
    github: "vercel/next.js",
    category: "framework",
  },
];

const bySlug = new Map(recommendedProjects.map((p) => [p.slug, p] as const));

export function isRecommendedProject(slug: string): boolean {
  return bySlug.has(slug);
}

export function getRecommendedProjectBySlug(slug: string): RecommendedProject | undefined {
  return bySlug.get(slug);
}

/** 将推荐项映射为详情/分享页可用的只读视图（无数据库、不可刷新快照） */
export function recommendedProjectToPageView(p: RecommendedProject): ProjectPageView {
  const githubUrl = `https://github.com/${p.github}`;
  return {
    slug: p.slug,
    name: p.name,
    logoUrl: undefined,
    tagline: p.tagline,
    description: `${p.tagline}\n\n此为 MUHUB 冷启动推荐示例，数据未写入数据库；可使用「认领项目」跳转到创建页转为正式项目。「刷新 GitHub 数据」在入库前不可用。`,
    websiteUrl: undefined,
    githubUrl,
    githubSnapshot: {
      repoFullName: p.github,
      defaultBranch: "main",
      stars: 0,
      forks: 0,
      openIssues: 0,
      watchers: 0,
      commitCount7d: 0,
      commitCount30d: 0,
      contributorsCount: 0,
      lastCommitAt: undefined,
      fetchedAt: undefined,
    },
    socials: [],
    updates: [],
    status: "ACTIVE",
    createdAt: new Date(0),
    claimStatus: "UNCLAIMED",
    claimedAt: null,
    claimedBy: null,
    sourceType: undefined,
    isFeatured: false,
  };
}

export function getRecommendedProjectPageView(slug: string): ProjectPageView | null {
  const p = bySlug.get(slug);
  return p ? recommendedProjectToPageView(p) : null;
}

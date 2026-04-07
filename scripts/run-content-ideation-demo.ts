/**
 * Content Ideation Agent V1 演示：组装上下文 → 运行规则 Agent → 打印并追加写入 data/content-ideas.json。
 *
 * 运行：
 *   pnpm content:ideation
 *   pnpm content:ideation -- "手工观察主题（可选）"
 */

import { appendContentIdeas } from "../agents/content/ideation-store"
import { runIdeationAgent, type IdeationProjectUpdateSignal } from "../agents/content/ideation-agent"
import { readSiteContentLatestFirst } from "../agents/growth/site-content-store"
import { PROJECT_ACTIVE_FILTER } from "../lib/project-active-filter"
import { prisma } from "../lib/prisma"

const DEMO_SIGNALS: IdeationProjectUpdateSignal[] = [
  {
    projectSlug: "ideation-demo",
    projectName: "Ideation Demo 项目",
    recentUpdateTitle: "演示：登记一条公开动态",
    updateCount: 2,
  },
]

async function loadProjectSignals(): Promise<IdeationProjectUpdateSignal[]> {
  if (!process.env.DATABASE_URL?.trim()) {
    return DEMO_SIGNALS
  }
  try {
    const projects = await prisma.project.findMany({
      where: {
        ...PROJECT_ACTIVE_FILTER,
        updates: { some: {} },
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
      select: {
        slug: true,
        name: true,
        _count: { select: { updates: true } },
        updates: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { title: true },
        },
      },
    })
    if (projects.length === 0) {
      return DEMO_SIGNALS
    }
    return projects.map((p) => ({
      projectSlug: p.slug,
      projectName: p.name,
      recentUpdateTitle: p.updates[0]?.title,
      updateCount: p._count.updates,
    }))
  } catch (e) {
    console.warn("[content-ideation-demo] DB read failed; using fixture signals.", e)
    return DEMO_SIGNALS
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

async function main() {
  const manualTopic = process.argv.slice(2).join(" ").trim() || undefined
  const asOf = new Date().toISOString()

  const [projectSignals, siteContent] = await Promise.all([loadProjectSignals(), readSiteContentLatestFirst()])

  const ideas = runIdeationAgent(
    {
      asOf,
      projectsWithUpdates: projectSignals,
      siteContent: siteContent.slice(0, 3),
      manualTopic,
    },
    { maxIdeas: 5 },
  )

  console.log(`[content-ideation-demo] generated ${ideas.length} idea(s).\n`)
  console.log(JSON.stringify(ideas, null, 2))

  await appendContentIdeas(ideas)
  console.log("\n[content-ideation-demo] appended to data/content-ideas.json")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

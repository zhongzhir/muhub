import Link from "next/link";
import Hero from "@/components/home/hero";
import GeoFaq from "@/components/home/geo-faq";
import Features from "@/components/home/features";
import { ProjectClaimCta } from "@/components/home/project-claim-cta";
import { ProjectCard } from "@/components/project-card";
import { fetchHomepageLatestProjects } from "@/lib/project-list";
import { type ProjectActivity, readRecentPublicActivities } from "@/lib/activity/project-activity-service";
import { RecentProjectActivitySection } from "@/components/home/recent-project-activity";

export default async function HomePage() {
  const latestProjects = await fetchHomepageLatestProjects(6);
  const recentActivities = await readRecentPublicActivities(8);
  // fallback: 当 Activity 数据不足时，使用真实 Project.updatedAt 兜底，后续应由 Activity 全量覆盖。
  const fallbackActivities: ProjectActivity[] =
    recentActivities.length === 0
      ? latestProjects.slice(0, 6).map((project, index) => ({
          id: `fallback-${project.slug}-${index}`,
          projectId: `fallback-${project.slug}`,
          type: "project_profile_updated",
          projectSlug: project.slug,
          projectName: project.name,
          sourceType: "project_fallback",
          sourceUrl: project.githubUrl ?? project.websiteUrl ?? null,
          title: "项目信息最近有更新",
          summary: project.tagline?.trim() || "查看项目主页获取最新公开信息。",
          occurredAt: project.updatedAt.toISOString(),
          createdAt: new Date().toISOString(),
          isPublic: true,
          metadataJson: { fallback: true },
        }))
      : [];
  const homepageActivities = recentActivities.length > 0 ? recentActivities : fallbackActivities;

  return (
    <main className="min-h-screen">
      <Hero />
      <section className="border-t border-zinc-200/80 py-14 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">最新收录项目</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">来自公开项目库的实时内容</p>
            </div>
            <Link
              href="/projects?sort=new"
              className="text-sm font-medium text-teal-700 underline-offset-4 hover:underline dark:text-teal-400"
            >
              查看全部项目
            </Link>
          </div>
          {latestProjects.length > 0 ? (
            <ul className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
              {latestProjects.map((p) => (
                <li key={p.slug} className="h-full">
                  <ProjectCard project={p} variant="plaza" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-zinc-200 bg-white px-4 py-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              当前还没有可展示的公开项目。
            </p>
          )}
        </div>
      </section>
      <RecentProjectActivitySection
        activities={homepageActivities.slice(0, 8)}
        title="最新动态"
        subtitle="项目更新、发布和公开活动时间线"
        actionHref="/projects?sort=updated"
        actionLabel="查看全部动态"
      />
      <Features />
      <ProjectClaimCta />
      <GeoFaq />
    </main>
  );
}

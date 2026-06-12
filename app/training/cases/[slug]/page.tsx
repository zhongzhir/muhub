import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SceneTag, TrainingPageShell } from "../../_components/training-chrome";
import { getTrainingSessionContext } from "../../lib/auth";
import { getAccessibleTrainingCaseBySlug } from "../../lib/queries";

export const metadata: Metadata = {
  title: "案例详情 | 出版融合发展工程实践交流活动",
  robots: { index: false },
};

const fieldLabels = [
  ["summary", "项目简介"],
  ["needAndUsers", "需求描述与用户画像"],
  ["competitors", "竞争格局与同类竞品"],
  ["technologyAdoption", "技术选型及组织采纳方式"],
  ["marketAndBenefits", "市场运营与两个效益"],
  ["teamMechanism", "团队与管理机制"],
  ["challenges", "问题与挑战"],
  ["touchpointExperience", "触达与体验"],
] as const;

export default async function TrainingCaseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const context = await getTrainingSessionContext();
  const item = await getAccessibleTrainingCaseBySlug(slug, context.accessParticipant);
  if (!item) {
    notFound();
  }

  return (
    <TrainingPageShell title={item.name} subtitle={`${item.organization} · ${item.track}`}>
      <article className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex flex-wrap gap-2">
          <SceneTag tag={`${item.classNo} 班 ${item.groupNo} 组`} />
          <SceneTag tag={item.track} />
          {item.traits ? <SceneTag tag={item.traits} /> : null}
        </div>

        <div className="grid gap-5">
          {fieldLabels.map(([key, label]) => (
            <section key={key} className="border-t border-zinc-100 pt-5 first:border-t-0 first:pt-0 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{label}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {item[key] ?? "该部分资料将由活动组织方统一补充，当前请以现场发放材料为准。"}
              </p>
            </section>
          ))}
        </div>
      </article>
    </TrainingPageShell>
  );
}

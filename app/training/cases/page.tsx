import Link from "next/link";
import type { Metadata } from "next";

import { SceneTag, TrainingPageShell, trainingLoginHref } from "../_components/training-chrome";
import { getTrainingSessionContext } from "../lib/auth";
import { listAccessibleTrainingCases } from "../lib/queries";

export const metadata: Metadata = {
  title: "案例资料 | 出版融合发展工程实践交流活动",
  description: "按班级和小组查看出版融合实践案例资料。",
  robots: { index: false },
};

export default async function TrainingCasesPage() {
  const context = await getTrainingSessionContext();
  const cases = await listAccessibleTrainingCases(context.accessParticipant);

  return (
    <TrainingPageShell
      title="案例资料"
      subtitle="案例资料按活动身份开放。学员仅查看本组案例，导师查看负责班级案例。"
    >
      {!context.accessParticipant ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            请先登录并使用活动邀请码绑定身份，绑定后即可查看对应班级和小组的案例资料。
          </p>
          <Link
            href={context.userId ? "/training/register" : trainingLoginHref("/training/register")}
            className="mt-5 inline-flex rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400"
          >
            {context.userId ? "绑定活动身份" : "登录后绑定"}
          </Link>
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          暂未找到可访问的案例资料，请确认活动数据已初始化。
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {cases.map((item) => (
            <Link
              key={item.id}
              href={`/training/cases/${item.slug}`}
              className="rounded-xl border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <SceneTag tag={`${item.classNo} 班 ${item.groupNo} 组`} />
                <SceneTag tag={item.track} />
              </div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{item.name}</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{item.organization}</p>
              <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                {item.traits ?? item.summary ?? "该案例资料将由活动组织方统一补充。"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </TrainingPageShell>
  );
}

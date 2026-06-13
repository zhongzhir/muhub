import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/auth";

import { TrainingPageShell, trainingLoginHref } from "../_components/training-chrome";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "活动身份绑定 | 出版融合发展工程实践交流活动",
  description: "使用活动邀请码绑定学员、导师或管理员身份。",
  robots: { index: false },
};

export default async function TrainingRegisterPage() {
  const session = await auth();

  return (
    <TrainingPageShell
      title="活动身份绑定"
      subtitle="请使用主办方发放的邀请码绑定本次实践交流活动身份。"
    >
      {!session?.user?.id ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            请先登录，再使用主办方发放的邀请码绑定活动身份。
          </p>
          <Link
            href={trainingLoginHref("/training/register")}
            className="mt-5 inline-flex rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400"
          >
            登录后绑定
          </Link>
        </div>
      ) : (
        <RegisterForm />
      )}
    </TrainingPageShell>
  );
}

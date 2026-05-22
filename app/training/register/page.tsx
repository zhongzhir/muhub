import type { Metadata } from "next";

import { TrainingPageShell } from "../_components/training-chrome";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "报名登记 · 数智出版与AI出版实训课系列",
  description: "华闻传媒研究院出版行业 AI 应用实训课报名登记",
  robots: { index: false },
};

export default function TrainingRegisterPage() {
  return (
    <TrainingPageShell
      title="报名登记"
      subtitle="填写以下信息完成实训课报名，工作人员将在 1 个工作日内与您确认。"
    >
      <RegisterForm />
    </TrainingPageShell>
  );
}

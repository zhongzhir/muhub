import type { Metadata } from "next";

import { TrainingPageShell } from "../_components/training-chrome";
import { HomeworkForm } from "./homework-form";

export const metadata: Metadata = {
  title: "作业提交 · 数智出版与AI出版实训课系列",
  description: "学员实训作业在线提交",
  robots: { index: false },
};

export default function TrainingHomeworkPage() {
  return (
    <TrainingPageShell
      title="学员作业提交"
      subtitle="完成实训任务后，请在此提交作业报告。优秀成果经审核后可在首页展示。"
    >
      <HomeworkForm />
    </TrainingPageShell>
  );
}

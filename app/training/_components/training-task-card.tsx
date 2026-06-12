import { MentorReviewForm } from "./mentor-review-form";
import { TrainingRecordForm } from "./training-record-form";
import { TrainingRecordList, type TrainingRecordListItem } from "./training-record-list";

export function TrainingTaskCard({
  groupId,
  task,
  records,
  canWriteStudentRecords,
  canWriteMentorReview,
}: {
  groupId: string;
  task: {
    id: string;
    dayIndex: number;
    title: string;
    description: string;
    activities: string[];
    deliverables: string[];
  };
  records: TrainingRecordListItem[];
  canWriteStudentRecords: boolean;
  canWriteMentorReview: boolean;
}) {
  const discussionRecords = records.filter((record) => record.type === "discussion_note");
  const submissionRecords = records.filter((record) => record.type === "task_submission");
  const reviewRecords = records.filter((record) => record.type === "mentor_review");

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium text-zinc-500">第 {task.dayIndex} 日</div>
      <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{task.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">{task.description}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <InfoList title="活动要求" items={task.activities} />
        <InfoList title="应提交内容" items={task.deliverables} />
      </div>

      <div className="mt-5 grid gap-5">
        <TrainingRecordList title="讨论纪要" records={discussionRecords} />
        {canWriteStudentRecords ? (
          <TrainingRecordForm
            groupId={groupId}
            taskId={task.id}
            type="discussion_note"
            titleLabel="纪要标题"
            contentLabel="纪要正文"
          />
        ) : null}

        <TrainingRecordList title="阶段成果" records={submissionRecords} />
        {canWriteStudentRecords ? (
          <TrainingRecordForm
            groupId={groupId}
            taskId={task.id}
            type="task_submission"
            titleLabel="阶段成果标题"
            contentLabel="阶段成果说明"
          />
        ) : null}

        <TrainingRecordList title="导师点评" records={reviewRecords} />
        {canWriteMentorReview ? <MentorReviewForm groupId={groupId} taskId={task.id} /> : null}
      </div>
    </article>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h4>
      <ul className="mt-2 space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
        {items.map((item) => (
          <li key={item}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}

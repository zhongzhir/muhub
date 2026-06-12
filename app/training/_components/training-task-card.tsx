import { FileUploadPanel } from "./file-upload-panel";
import { MentorReviewForm } from "./mentor-review-form";
import { TrainingFileList, type TrainingFileListItem } from "./training-file-list";
import { TrainingRecordForm } from "./training-record-form";
import { TrainingRecordList, type TrainingRecordListItem } from "./training-record-list";

export function TrainingTaskCard({
  groupId,
  task,
  records,
  files,
  canWriteStudentRecords,
  canWriteMentorReview,
  canUploadFiles,
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
  files: TrainingFileListItem[];
  canWriteStudentRecords: boolean;
  canWriteMentorReview: boolean;
  canUploadFiles: boolean;
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

        <section className="rounded-lg border border-zinc-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/20">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">资料与成果文件</h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                本任务相关文件仅当前小组、负责导师和管理员可下载。
              </p>
            </div>
          </div>
          <TrainingFileList files={files} />
          {canUploadFiles ? (
            <div className="mt-3">
              <FileUploadPanel groupId={groupId} taskId={task.id} />
            </div>
          ) : null}
        </section>
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

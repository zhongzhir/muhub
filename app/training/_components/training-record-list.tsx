export type TrainingRecordListItem = {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  updatedAt: string;
  authorName: string;
};

const typeLabel: Record<string, string> = {
  discussion_note: "讨论纪要",
  task_submission: "阶段成果",
  mentor_review: "导师点评",
  final_submission: "最终成果",
};

export function TrainingRecordList({
  title,
  records,
}: {
  title: string;
  records: TrainingRecordListItem[];
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</h4>
      {records.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800">
          暂无记录
        </p>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <article key={record.id} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{typeLabel[record.type] ?? record.type}</span>
                <span>·</span>
                <span>{record.authorName}</span>
                <span>·</span>
                <span>{record.updatedAt}</span>
              </div>
              {record.title ? (
                <h5 className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{record.title}</h5>
              ) : null}
              {record.content ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {record.content}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

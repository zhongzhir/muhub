export type TrainingFileListItem = {
  id: string;
  originalName: string;
  sizeBytes: number;
  createdAt: string;
  uploaderName: string;
};

function formatSize(sizeBytes: number): string {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
  if (sizeBytes >= 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${sizeBytes} B`;
}

export function TrainingFileList({ files }: { files: TrainingFileListItem[] }) {
  if (!files.length) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无已上传文件。</p>;
  }

  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li
          key={file.id}
          className="flex flex-col gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950/40 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="truncate font-medium text-zinc-900 dark:text-zinc-50">{file.originalName}</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {file.uploaderName} · {formatSize(file.sizeBytes)} · {file.createdAt}
            </div>
          </div>
          <a
            href={`/api/training/files/${file.id}/download`}
            className="inline-flex shrink-0 justify-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-teal-600 hover:text-teal-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-teal-400 dark:hover:text-teal-300"
          >
            下载
          </a>
        </li>
      ))}
    </ul>
  );
}

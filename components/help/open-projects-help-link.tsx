import Link from "next/link";

export function OpenProjectsHelpLink({ className }: { className?: string }) {
  return (
    <p className={className ?? "text-xs text-zinc-500 dark:text-zinc-400"}>
      <Link
        href="/help/open-projects"
        className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
      >
        不了解 GitHub？查看开放项目入门
      </Link>
    </p>
  );
}

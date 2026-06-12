import Link from "next/link";

import { SceneTag } from "./training-chrome";

export function GroupSwitcher({
  groups,
  selectedGroupId,
}: {
  groups: Array<{ id: string; name: string; classNo: number; groupNo: number }>;
  selectedGroupId: string;
}) {
  if (groups.length <= 1) {
    const group = groups[0];
    return group ? <SceneTag tag={group.name} /> : null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((group) => {
        const active = group.id === selectedGroupId;
        return (
          <Link
            key={group.id}
            href={`/training/workspace?groupId=${group.id}`}
            className={
              active
                ? "rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white dark:bg-teal-500"
                : "rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            }
          >
            {group.name}
          </Link>
        );
      })}
    </div>
  );
}

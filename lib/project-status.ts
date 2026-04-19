import type { ProjectStatus } from "@prisma/client";

const LABELS: Record<ProjectStatus, string> = {
  DRAFT: "草稿",
  READY: "待发布",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

export function projectStatusLabel(status: ProjectStatus): string {
  return LABELS[status] ?? status;
}

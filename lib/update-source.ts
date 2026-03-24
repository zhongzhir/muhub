import type { ProjectUpdateSourceType } from "@prisma/client";

const LABELS: Record<ProjectUpdateSourceType, string> = {
  MANUAL: "手动",
  GITHUB: "GitHub",
  SOCIAL: "社媒",
  SYSTEM: "系统",
};

export function updateSourceTypeLabel(t: ProjectUpdateSourceType): string {
  return LABELS[t] ?? t;
}

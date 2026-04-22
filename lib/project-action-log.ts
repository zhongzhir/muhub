import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type ProjectActionType =
  | "save"
  | "publish"
  | "hide"
  | "archive"
  | "import"
  | "marketing_generate";

const PROJECT_ACTION_LOG_SOURCE_LABEL = "project-action-log";

export async function writeProjectActionLog(
  args: {
    projectId: string;
    action: ProjectActionType;
    detail?: string | null;
    occurredAt?: Date;
  },
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  const occurredAt = args.occurredAt ?? new Date();
  await db.projectUpdate.create({
    data: {
      projectId: args.projectId,
      sourceType: "SYSTEM",
      sourceLabel: PROJECT_ACTION_LOG_SOURCE_LABEL,
      title: `action:${args.action}`,
      summary: args.detail?.trim() || null,
      content: args.detail?.trim() || null,
      metaJson: JSON.stringify({
        kind: "project_action_log",
        action: args.action,
      }),
      occurredAt,
    },
  });
}

function actionFromTitle(title: string): ProjectActionType | null {
  const value = title.replace(/^action:/, "").trim();
  if (
    value === "save" ||
    value === "publish" ||
    value === "hide" ||
    value === "archive" ||
    value === "import" ||
    value === "marketing_generate"
  ) {
    return value;
  }
  return null;
}

export async function readProjectActionLogs(projectId: string, take = 20) {
  const rows = await prisma.projectUpdate.findMany({
    where: {
      projectId,
      sourceType: "SYSTEM",
      sourceLabel: PROJECT_ACTION_LOG_SOURCE_LABEL,
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      summary: true,
      occurredAt: true,
      createdAt: true,
    },
  });

  return rows
    .map((row) => ({
      id: row.id,
      action: actionFromTitle(row.title),
      detail: row.summary,
      occurredAt: row.occurredAt ?? row.createdAt,
    }))
    .filter((row): row is { id: string; action: ProjectActionType; detail: string | null; occurredAt: Date } => Boolean(row.action));
}

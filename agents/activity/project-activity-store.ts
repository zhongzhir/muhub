import { mkdir, readFile, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { dirname, join } from "path";

export type ProjectActivityType = "release" | "star" | "update";

export type ProjectActivity = {
  id: string;
  type: ProjectActivityType;
  projectSlug: string;
  projectName?: string;
  githubUrl: string;
  repoFullName: string;
  title: string;
  summary?: string;
  occurredAt: string;
  fetchedAt: string;
  stars?: number;
  releaseTag?: string;
  pushedAt?: string;
};

const REL_PATH = join("data", "project-activity.json");
const MAX_RECORDS = 500;

function activityFilePath(): string {
  return join(process.cwd(), REL_PATH);
}

function isProjectActivity(v: unknown): v is ProjectActivity {
  if (!v || typeof v !== "object") {
    return false;
  }
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.type === "release" || o.type === "star" || o.type === "update") &&
    typeof o.projectSlug === "string" &&
    typeof o.githubUrl === "string" &&
    typeof o.repoFullName === "string" &&
    typeof o.title === "string" &&
    typeof o.occurredAt === "string" &&
    typeof o.fetchedAt === "string"
  );
}

export async function ensureProjectActivityFile(): Promise<void> {
  const path = activityFilePath();
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path, "utf8");
  } catch {
    await writeFile(path, "[]\n", "utf8");
  }
}

export async function readProjectActivities(): Promise<ProjectActivity[]> {
  await ensureProjectActivityFile();
  const path = activityFilePath();
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isProjectActivity);
  } catch {
    return [];
  }
}

function getActivityTime(a: ProjectActivity): number {
  const t = new Date(a.occurredAt).getTime();
  if (!Number.isNaN(t)) {
    return t;
  }
  const fallback = new Date(a.fetchedAt).getTime();
  return Number.isNaN(fallback) ? 0 : fallback;
}

export async function readRecentProjectActivities(
  limit = 8,
  validProjectSlugs?: readonly string[],
): Promise<ProjectActivity[]> {
  const size = Math.max(1, Math.floor(limit));
  const rows = await readProjectActivities();
  const valid = validProjectSlugs?.length ? new Set(validProjectSlugs) : null;
  const filtered = valid ? rows.filter((row) => valid.has(row.projectSlug)) : rows;
  return filtered.sort((a, b) => getActivityTime(b) - getActivityTime(a)).slice(0, size);
}

function isSameActivity(a: ProjectActivity, b: ProjectActivity): boolean {
  if (a.projectSlug !== b.projectSlug || a.type !== b.type) {
    return false;
  }
  if (a.type === "release") {
    return a.releaseTag === b.releaseTag && a.repoFullName === b.repoFullName;
  }
  if (a.type === "star") {
    return a.stars === b.stars && a.repoFullName === b.repoFullName;
  }
  return a.pushedAt === b.pushedAt && a.repoFullName === b.repoFullName;
}

export async function appendProjectActivity(
  input: Omit<ProjectActivity, "id" | "fetchedAt">,
): Promise<ProjectActivity | null> {
  const existing = await readProjectActivities();
  const next: ProjectActivity = {
    ...input,
    id: randomUUID(),
    fetchedAt: new Date().toISOString(),
  };
  const duplicate = existing.some((row) => isSameActivity(row, next));
  if (duplicate) {
    return null;
  }
  const merged = [...existing, next].slice(-MAX_RECORDS);
  await writeFile(activityFilePath(), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return next;
}

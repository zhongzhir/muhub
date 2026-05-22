/**
 * Training V1：报名与作业本地 JSON 存储（可迁移 DB）。
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

import type { TrainingHomework, TrainingRegistration } from "./types";

const REGISTRATIONS_PATH = join("data", "training-registrations.json");
const HOMEWORK_PATH = join("data", "training-homework.json");

function registrationsFile(): string {
  return join(process.cwd(), REGISTRATIONS_PATH);
}

function homeworkFile(): string {
  return join(process.cwd(), HOMEWORK_PATH);
}

async function readJsonArray<T>(path: string): Promise<T[]> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function appendJsonRecord<T>(path: string, record: T): Promise<void> {
  const list = await readJsonArray<T>(path);
  list.push(record);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(list, null, 2)}\n`, "utf8");
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function appendRegistration(
  input: Omit<TrainingRegistration, "id" | "submittedAt">,
): Promise<TrainingRegistration> {
  const record: TrainingRegistration = {
    ...input,
    id: newId("reg"),
    submittedAt: new Date().toISOString(),
  };
  await appendJsonRecord(registrationsFile(), record);
  return record;
}

export async function appendHomework(
  input: Omit<TrainingHomework, "id" | "submittedAt">,
): Promise<TrainingHomework> {
  const record: TrainingHomework = {
    ...input,
    id: newId("hw"),
    submittedAt: new Date().toISOString(),
  };
  await appendJsonRecord(homeworkFile(), record);
  return record;
}

export async function listRegistrations(): Promise<TrainingRegistration[]> {
  const list = await readJsonArray<TrainingRegistration>(registrationsFile());
  return list.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

export async function listHomework(): Promise<TrainingHomework[]> {
  const list = await readJsonArray<TrainingHomework>(homeworkFile());
  return list.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
  );
}

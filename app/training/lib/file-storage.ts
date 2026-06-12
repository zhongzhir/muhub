import crypto from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type TrainingFileStorageContext = {
  eventSlug: string;
  classNo: number;
  groupNo: number;
};

export type TrainingStoredFile = {
  id: string;
  storageKey: string;
  sizeBytes: number;
  mimeType?: string;
  originalName: string;
};

export const MAX_TRAINING_FILE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_TRAINING_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".zip",
]);

export function getTrainingUploadRoot(): string {
  return process.env.TRAINING_UPLOAD_DIR?.trim() || path.join(process.cwd(), "storage", "training", "uploads");
}

export function buildTrainingStoragePrefix(context: TrainingFileStorageContext): string {
  return path.posix.join(context.eventSlug, `c${context.classNo}-g${context.groupNo}`);
}

export function sanitizeTrainingFileName(name: string): string {
  const baseName = path.basename(name).replace(/[/\\]+/g, "-").trim();
  const safeName = baseName
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return safeName || "upload";
}

export function assertAllowedTrainingUpload(input: { name: string; size: number }) {
  if (input.size > MAX_TRAINING_FILE_BYTES) {
    throw new Error("文件不能超过 50MB。");
  }

  const safeName = sanitizeTrainingFileName(input.name);
  const ext = path.extname(safeName).toLowerCase();
  if (!ext || !ALLOWED_TRAINING_FILE_EXTENSIONS.has(ext)) {
    throw new Error("不支持的文件类型。");
  }
}

function dateFolder(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function buildTrainingStorageKey(
  context: TrainingFileStorageContext,
  fileId: string,
  originalName: string,
  date = new Date(),
): string {
  const safeName = sanitizeTrainingFileName(originalName);
  return path.posix.join(
    buildTrainingStoragePrefix(context),
    dateFolder(date),
    `${sanitizeTrainingFileName(fileId)}-${safeName}`,
  );
}

export function resolveTrainingStoragePath(storageKey: string): string {
  const normalized = storageKey.split(/[\\/]+/).filter(Boolean);
  const root = path.resolve(getTrainingUploadRoot());
  const target = path.resolve(root, ...normalized);
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw new Error("非法文件路径。");
  }
  return target;
}

export async function saveTrainingUploadedFile(file: File, context: TrainingFileStorageContext): Promise<TrainingStoredFile> {
  assertAllowedTrainingUpload({ name: file.name, size: file.size });

  const id = crypto.randomUUID();
  const originalName = sanitizeTrainingFileName(file.name);
  const storageKey = buildTrainingStorageKey(context, id, originalName);
  const targetPath = resolveTrainingStoragePath(storageKey);
  await mkdir(path.dirname(targetPath), { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(targetPath, bytes, { flag: "wx" });

  return {
    id,
    storageKey,
    sizeBytes: bytes.byteLength,
    mimeType: file.type || undefined,
    originalName,
  };
}

export async function readTrainingStoredFile(storageKey: string) {
  const targetPath = resolveTrainingStoragePath(storageKey);
  const [data, info] = await Promise.all([readFile(targetPath), stat(targetPath)]);
  return { data, sizeBytes: info.size };
}

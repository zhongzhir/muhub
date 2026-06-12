import path from "node:path";

export type TrainingFileStorageContext = {
  eventSlug: string;
  classNo: number;
  groupNo: number;
};

export type TrainingStoredFile = {
  storageKey: string;
  sizeBytes: number;
  mimeType?: string;
};

export function getTrainingUploadRoot(): string {
  return process.env.TRAINING_UPLOAD_DIR?.trim() || path.join(process.cwd(), "storage", "training", "uploads");
}

export function buildTrainingStoragePrefix(context: TrainingFileStorageContext): string {
  return path.join(context.eventSlug, `class-${context.classNo}`, `group-${context.groupNo}`);
}

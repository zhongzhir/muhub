export const TRAINING_SESSION_OPTIONS = [
  "2026年第一期（7月）",
  "2026年第二期（待定）",
  "2026年第三期（待定）",
  "其他 / 咨询后确认",
] as const;

export type TrainingSession = (typeof TRAINING_SESSION_OPTIONS)[number];

export type TrainingRegistration = {
  id: string;
  name: string;
  organization: string;
  title: string;
  phone: string;
  email: string;
  session: string;
  note: string;
  submittedAt: string;
};

export type TrainingHomework = {
  id: string;
  name: string;
  organization: string;
  phone: string;
  session: string;
  homeworkTitle: string;
  homeworkContent: string;
  attachmentUrl: string;
  submittedAt: string;
};

export type TrainingFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

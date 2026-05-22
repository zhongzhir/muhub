"use server";

import { appendHomework, appendRegistration } from "./lib/store";
import type { TrainingFormState } from "./lib/types";
import { TRAINING_SESSION_OPTIONS } from "./lib/types";

function required(value: FormDataEntryValue | null, label: string): string | undefined {
  const text = String(value ?? "").trim();
  if (!text) {
    return `${label}不能为空`;
  }
  return undefined;
}

function pickField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function submitRegistration(
  _prev: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const name = pickField(formData, "name");
  const organization = pickField(formData, "organization");
  const title = pickField(formData, "title");
  const phone = pickField(formData, "phone");
  const email = pickField(formData, "email");
  const session = pickField(formData, "session");
  const note = pickField(formData, "note");

  const fieldErrors: Record<string, string> = {};
  const nameErr = required(name, "姓名");
  if (nameErr) fieldErrors.name = nameErr;
  const orgErr = required(organization, "单位");
  if (orgErr) fieldErrors.organization = orgErr;
  const titleErr = required(title, "职务");
  if (titleErr) fieldErrors.title = titleErr;
  const phoneErr = required(phone, "手机");
  if (phoneErr) fieldErrors.phone = phoneErr;
  const emailErr = required(email, "邮箱");
  if (emailErr) fieldErrors.email = emailErr;
  const sessionErr = required(session, "参加课程期次");
  if (sessionErr) fieldErrors.session = sessionErr;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "邮箱格式不正确";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, message: "请修正表单中的错误" };
  }

  try {
    await appendRegistration({
      name,
      organization,
      title,
      phone,
      email,
      session,
      note,
    });
    return { ok: true, message: "报名已提交，工作人员将在 1 个工作日内与您确认。" };
  } catch {
    return { ok: false, message: "提交失败，请稍后重试。" };
  }
}

export async function submitHomework(
  _prev: TrainingFormState,
  formData: FormData,
): Promise<TrainingFormState> {
  const name = pickField(formData, "name");
  const organization = pickField(formData, "organization");
  const phone = pickField(formData, "phone");
  const session = pickField(formData, "session");
  const homeworkTitle = pickField(formData, "homeworkTitle");
  const homeworkContent = pickField(formData, "homeworkContent");
  const attachmentUrl = pickField(formData, "attachmentUrl");

  const fieldErrors: Record<string, string> = {};
  const nameErr = required(name, "姓名");
  if (nameErr) fieldErrors.name = nameErr;
  const orgErr = required(organization, "单位");
  if (orgErr) fieldErrors.organization = orgErr;
  const phoneErr = required(phone, "手机");
  if (phoneErr) fieldErrors.phone = phoneErr;
  const sessionErr = required(session, "课程期次");
  if (sessionErr) fieldErrors.session = sessionErr;
  const titleErr = required(homeworkTitle, "作业标题");
  if (titleErr) fieldErrors.homeworkTitle = titleErr;
  const contentErr = required(homeworkContent, "作业内容");
  if (contentErr) fieldErrors.homeworkContent = contentErr;

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors, message: "请修正表单中的错误" };
  }

  try {
    await appendHomework({
      name,
      organization,
      phone,
      session,
      homeworkTitle,
      homeworkContent,
      attachmentUrl,
    });
    return { ok: true, message: "作业已提交，感谢参与实训！" };
  } catch {
    return { ok: false, message: "提交失败，请稍后重试。" };
  }
}

export { TRAINING_SESSION_OPTIONS };

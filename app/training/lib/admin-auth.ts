import { auth } from "@/auth";
import {
  AdminAuthError,
  getMuHubAdminDebugInfo,
  isMuHubAdminUser,
} from "@/lib/admin-auth";
import { normalizeMainlandPhone } from "@/lib/auth/phone-code";

type TrainingAdminSessionUser = {
  id?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

function parseTrainingAdminPhoneList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[,，\s]+/)
      .map((value) => normalizeMainlandPhone(value))
      .filter(Boolean),
  );
}

export function parseTrainingAdminPhones(): Set<string> {
  return parseTrainingAdminPhoneList(process.env.TRAINING_ADMIN_PHONES);
}

export function isTrainingAdminUser(user: TrainingAdminSessionUser | undefined): boolean {
  if (!user?.id) return false;
  if (isMuHubAdminUser(user)) return true;

  const phone = typeof user.phone === "string" ? normalizeMainlandPhone(user.phone) : "";
  return Boolean(phone && parseTrainingAdminPhones().has(phone));
}

export function getTrainingAdminDebugInfo(user: TrainingAdminSessionUser | undefined) {
  return {
    ...getMuHubAdminDebugInfo(user),
    phone: user?.phone ?? null,
    trainingAdminPhonesConfigured: parseTrainingAdminPhones().size,
  };
}

export async function requireTrainingAdmin(): Promise<{
  userId: string;
  email?: string | null;
  phone?: string | null;
}> {
  const session = await auth();
  const user: TrainingAdminSessionUser = {
    id: session?.user?.id,
    email: session?.user?.email,
    phone: (session?.user as { phone?: string | null } | undefined)?.phone ?? null,
    role: (session?.user as { role?: string | null } | undefined)?.role ?? null,
  };

  if (!user.id) {
    throw new AdminAuthError("UNAUTHORIZED", "请先登录");
  }
  if (!isTrainingAdminUser(user)) {
    console.warn("[training-admin-auth] forbidden", getTrainingAdminDebugInfo(user));
    throw new AdminAuthError("FORBIDDEN", "无权访问 Training 管理后台");
  }

  return { userId: user.id, email: user.email ?? null, phone: user.phone ?? null };
}

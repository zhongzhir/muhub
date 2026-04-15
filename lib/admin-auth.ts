import { auth } from "@/auth";

type AdminSessionUser = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

const DEV_ALLOW_ALL_ADMINS =
  process.env.MUHUB_ADMIN_DEV_ALLOW_ALL === "1" ||
  process.env.MUHUB_ADMIN_DEV_ALLOW_ALL === "true";

function parseEnvList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) {
    return new Set();
  }
  return new Set(
    raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * 管理后台用户 ID 白名单：
 * - 优先新变量 ADMIN_USER_IDS
 * - 兼容旧变量 MUHUB_ADMIN_USER_IDS
 */
export function parseMuHubAdminUserIds(): Set<string> {
  return parseEnvList(process.env.ADMIN_USER_IDS ?? process.env.MUHUB_ADMIN_USER_IDS);
}

/**
 * 管理后台邮箱白名单（小写比较）：
 * - 优先新变量 ADMIN_EMAILS
 * - 兼容旧变量 MUHUB_ADMIN_EMAILS
 */
export function parseMuHubAdminEmails(): Set<string> {
  const rows = parseEnvList(process.env.ADMIN_EMAILS ?? process.env.MUHUB_ADMIN_EMAILS);
  return new Set([...rows].map((v) => v.toLowerCase()));
}

export function isMuHubAdminUserId(userId: string | undefined): boolean {
  if (!userId) {
    return false;
  }
  if (process.env.NODE_ENV === "development" && DEV_ALLOW_ALL_ADMINS) {
    return true;
  }
  const ids = parseMuHubAdminUserIds();
  return ids.has(userId);
}

export function isMuHubAdminUser(user: AdminSessionUser | undefined): boolean {
  if (!user?.id) {
    return false;
  }
  if (process.env.NODE_ENV === "development" && DEV_ALLOW_ALL_ADMINS) {
    return true;
  }

  // 兼容未来数据库 role 字段或 session 扩展
  if (typeof user.role === "string" && user.role.toUpperCase() === "ADMIN") {
    return true;
  }

  const adminIds = parseMuHubAdminUserIds();
  if (adminIds.has(user.id)) {
    return true;
  }

  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email) {
    const adminEmails = parseMuHubAdminEmails();
    if (adminEmails.has(email)) {
      return true;
    }
  }

  return false;
}

export function getMuHubAdminDebugInfo(user: AdminSessionUser | undefined) {
  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    role: user?.role ?? null,
    adminUserIdsConfigured: parseMuHubAdminUserIds().size,
    adminEmailsConfigured: parseMuHubAdminEmails().size,
    devAllowAll: process.env.NODE_ENV === "development" && DEV_ALLOW_ALL_ADMINS,
  };
}

export async function requireMuHubAdmin(): Promise<{ userId: string; email?: string | null }> {
  const session = await auth();
  const user = {
    id: session?.user?.id,
    email: session?.user?.email,
    role: (session?.user as { role?: string | null } | undefined)?.role ?? null,
  };
  const userId = user.id;
  if (!userId) {
    throw new AdminAuthError("UNAUTHORIZED", "请先登录");
  }
  if (!isMuHubAdminUser(user)) {
    console.warn("[admin-auth] forbidden", getMuHubAdminDebugInfo(user));
    throw new AdminAuthError("FORBIDDEN", "无权访问管理功能");
  }
  return { userId, email: user.email ?? null };
}

export class AdminAuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN", message: string) {
    super(message);
    this.code = code;
    this.name = "AdminAuthError";
  }
}

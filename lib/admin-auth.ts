import { auth } from "@/auth";
import type { UserRole } from "@prisma/client";

type AdminSessionUser = {
  id?: string | null;
  email?: string | null;
  role?: UserRole | string | null;
};

const DEV_ALLOW_ALL_ADMINS =
  process.env.MUHUB_ADMIN_DEV_ALLOW_ALL === "1" ||
  process.env.MUHUB_ADMIN_DEV_ALLOW_ALL === "true";

function parseEnvList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/**
 * Bootstrap 后备：ADMIN_USER_IDS / MUHUB_ADMIN_USER_IDS
 *
 * 用途：首次部署时，数据库中尚无 ADMIN role 用户，
 * 可通过环境变量临时指定初始管理员。
 * 正式运行后建议执行：
 *   UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
 * 并清除环境变量，完全依赖 DB role。
 */
export function parseMuHubAdminUserIds(): Set<string> {
  return parseEnvList(process.env.ADMIN_USER_IDS ?? process.env.MUHUB_ADMIN_USER_IDS);
}

export function parseMuHubAdminEmails(): Set<string> {
  const rows = parseEnvList(process.env.ADMIN_EMAILS ?? process.env.MUHUB_ADMIN_EMAILS);
  return new Set([...rows].map((v) => v.toLowerCase()));
}

/**
 * 管理员判定优先级：
 *  1. 开发环境 MUHUB_ADMIN_DEV_ALLOW_ALL=true → 全部放行（禁止用于生产）
 *  2. DB role === 'ADMIN'（主路径，session 已透传）
 *  3. 环境变量 ADMIN_USER_IDS / ADMIN_EMAILS（bootstrap 后备）
 */
export function isMuHubAdminUser(user: AdminSessionUser | undefined): boolean {
  if (!user?.id) return false;

  // 开发环境快速放行（勿用于生产）
  if (process.env.NODE_ENV === "development" && DEV_ALLOW_ALL_ADMINS) return true;

  // 主路径：DB role（由 session callback 写入 token，再透传至 session.user.role）
  if (typeof user.role === "string" && user.role.toUpperCase() === "ADMIN") return true;

  // Bootstrap 后备：环境变量白名单
  const adminIds = parseMuHubAdminUserIds();
  if (adminIds.has(user.id)) return true;

  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (email && parseMuHubAdminEmails().has(email)) return true;

  return false;
}

export function isMuHubAdminUserId(userId: string | undefined): boolean {
  if (!userId) return false;
  if (process.env.NODE_ENV === "development" && DEV_ALLOW_ALL_ADMINS) return true;
  return parseMuHubAdminUserIds().has(userId);
}

export function getMuHubAdminDebugInfo(user: AdminSessionUser | undefined) {
  return {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    dbRole: user?.role ?? null,
    adminUserIdsConfigured: parseMuHubAdminUserIds().size,
    adminEmailsConfigured: parseMuHubAdminEmails().size,
    devAllowAll: process.env.NODE_ENV === "development" && DEV_ALLOW_ALL_ADMINS,
  };
}

export async function requireMuHubAdmin(): Promise<{ userId: string; email?: string | null }> {
  const session = await auth();
  const user: AdminSessionUser = {
    id: session?.user?.id,
    email: session?.user?.email,
    role: (session?.user as { role?: UserRole | null } | undefined)?.role ?? null,
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

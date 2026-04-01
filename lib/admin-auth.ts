import { auth } from "@/auth";

const DEV_ALLOW_ALL_ADMINS =
  process.env.MUHUB_ADMIN_DEV_ALLOW_ALL === "1" ||
  process.env.MUHUB_ADMIN_DEV_ALLOW_ALL === "true";

/**
 * 管理后台：逗号分隔的用户 id（与 session.user.id / User.id 一致，cuid）。
 * 生产环境务必配置；开发可设 MUHUB_ADMIN_DEV_ALLOW_ALL=true 放行任意登录用户（仅本地）。
 */
export function parseMuHubAdminUserIds(): Set<string> {
  const raw = process.env.MUHUB_ADMIN_USER_IDS?.trim() ?? "";
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isMuHubAdminUserId(userId: string | undefined): boolean {
  if (!userId) {
    return false;
  }
  if (process.env.NODE_ENV === "development" && DEV_ALLOW_ALL_ADMINS) {
    return true;
  }
  const ids = parseMuHubAdminUserIds();
  if (ids.size === 0 && process.env.NODE_ENV === "development") {
    return false;
  }
  return ids.has(userId);
}

export async function requireMuHubAdmin(): Promise<{ userId: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new AdminAuthError("UNAUTHORIZED", "请先登录");
  }
  if (!isMuHubAdminUserId(userId)) {
    throw new AdminAuthError("FORBIDDEN", "无权访问管理功能");
  }
  return { userId };
}

export class AdminAuthError extends Error {
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(code: "UNAUTHORIZED" | "FORBIDDEN", message: string) {
    super(message);
    this.code = code;
    this.name = "AdminAuthError";
  }
}

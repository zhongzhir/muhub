import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    phone?: string | null;
    role?: UserRole | null;
  }

  interface Session {
    user: {
      id: string;
      phone?: string | null;
      /** 数据库 role 字段；ADMIN 拥有后台管理权限 */
      role?: UserRole | null;
    } & NonNullable<DefaultSession["user"]>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole | null;
  }
}

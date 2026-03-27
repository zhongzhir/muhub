import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * Edge 友好的共享配置（middleware 仅应依赖本文件，勿引入 Prisma）。
 */
export default {
  trustHost: true,
  providers: [GitHub],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {},
} satisfies NextAuthConfig;

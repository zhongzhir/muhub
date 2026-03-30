import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * 兼容多套 .env 命名（Auth.js 官方推荐 AUTH_GITHUB_*，亦为 GITHUB_ID 等常见写法兜底）。
 */
const githubClientId =
  process.env.AUTH_GITHUB_ID?.trim() ||
  process.env.GITHUB_ID?.trim() ||
  process.env.GITHUB_CLIENT_ID?.trim() ||
  "";

const githubClientSecret =
  process.env.AUTH_GITHUB_SECRET?.trim() ||
  process.env.GITHUB_SECRET?.trim() ||
  process.env.GITHUB_CLIENT_SECRET?.trim() ||
  "";

if (
  !process.env.GITHUB_ID?.trim() &&
  !process.env.AUTH_GITHUB_ID?.trim() &&
  !process.env.GITHUB_CLIENT_ID?.trim()
) {
  console.warn("⚠️ GitHub OAuth 未配置：请设置 AUTH_GITHUB_ID、GITHUB_ID 或 GITHUB_CLIENT_ID 之一");
}

/**
 * Edge 友好的共享配置（middleware 仅应依赖本文件，勿引入 Prisma）。
 */
export default {
  trustHost: true,
  providers: [
    GitHub({
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {},
} satisfies NextAuthConfig;

import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";
import { phoneCredentialsProvider } from "@/lib/auth/phone-credentials-provider";

const baseAdapter = PrismaAdapter(prisma);

const adapter = {
  ...baseAdapter,
  async linkAccount(account: AdapterAccount): Promise<void> {
    if (account.provider === "github") {
      const [sameGithubAccount, userGithubAccount] = await Promise.all([
        prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: "github",
              providerAccountId: account.providerAccountId,
            },
          },
          select: { userId: true },
        }),
        prisma.account.findFirst({
          where: {
            provider: "github",
            userId: account.userId,
            providerAccountId: { not: account.providerAccountId },
          },
          select: { id: true },
        }),
      ]);

      if (sameGithubAccount && sameGithubAccount.userId !== account.userId) {
        throw new Error("该 GitHub 账号已绑定其他用户。");
      }
      if (userGithubAccount) {
        throw new Error("当前用户已绑定其他 GitHub 账号。");
      }
    }

    await baseAdapter.linkAccount?.(account);
  },
} satisfies Adapter;

const config = {
  ...authConfig,
  providers: [...authConfig.providers, phoneCredentialsProvider()],
  adapter,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    ...(authConfig.callbacks ?? {}),
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { name: true, email: true, image: true, phone: true },
          });
          if (dbUser) {
            const su = session.user as {
              name: string | null;
              email: string | null;
              image: string | null;
              phone?: string | null;
            };
            su.name = dbUser.name;
            su.email = dbUser.email;
            su.image = dbUser.image;
            su.phone = dbUser.phone;
          }
        } catch {
          /* 忽略 DB 错误，避免登录态整页失败 */
        }
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config);

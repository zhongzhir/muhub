import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";
import { phoneCredentialsProvider } from "@/lib/auth/phone-credentials-provider";

const config = {
  ...authConfig,
  providers: [...authConfig.providers, phoneCredentialsProvider()],
  adapter: PrismaAdapter(prisma),
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

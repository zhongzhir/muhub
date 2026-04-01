import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import {
  hashPhoneVerificationCode,
  isValidMainlandMobile,
  normalizeMainlandPhone,
  PHONE_CODE_PURPOSE_LOGIN,
  PHONE_VERIFY_MAX_ATTEMPTS,
} from "@/lib/auth/phone-code";

export function phoneCredentialsProvider() {
  return Credentials({
    id: "phone-login",
    /** ASCII：避免 Edge / Auth 中间件在 Set-Cookie / Header 路径触发 ByteString（非 Latin-1）错误 */
    name: "phone",
    credentials: {
      phone: { label: "手机号", type: "text" },
      code: { label: "验证码", type: "text" },
    },
    async authorize(credentials) {
      const rawPhone = typeof credentials?.phone === "string" ? credentials.phone : "";
      const rawCode = typeof credentials?.code === "string" ? credentials.code.trim() : "";
      const phone = normalizeMainlandPhone(rawPhone);

      if (!phone || !isValidMainlandMobile(phone) || !/^\d{6}$/.test(rawCode)) {
        return null;
      }

      const now = new Date();

      const candidate = await prisma.phoneVerificationCode.findFirst({
        where: {
          phone,
          purpose: PHONE_CODE_PURPOSE_LOGIN,
          consumedAt: null,
          expiresAt: { gt: now },
          verifyAttempts: { lt: PHONE_VERIFY_MAX_ATTEMPTS },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!candidate) {
        return null;
      }

      const expectedHash = hashPhoneVerificationCode(phone, rawCode);
      if (candidate.codeHash !== expectedHash) {
        const bumped = await prisma.phoneVerificationCode.update({
          where: { id: candidate.id },
          data: { verifyAttempts: { increment: 1 } },
        });
        if (bumped.verifyAttempts >= PHONE_VERIFY_MAX_ATTEMPTS) {
          await prisma.phoneVerificationCode.update({
            where: { id: candidate.id },
            data: { consumedAt: now },
          });
        }
        return null;
      }

      const consumed = await prisma.phoneVerificationCode.updateMany({
        where: { id: candidate.id, consumedAt: null },
        data: { consumedAt: now },
      });

      if (consumed.count === 0) {
        return null;
      }

      let user = await prisma.user.findFirst({
        where: { accounts: { some: { provider: "phone", providerAccountId: phone } } },
      });

      if (!user) {
        try {
          user = await prisma.user.create({
            data: {
              name: `用户${phone.slice(-4)}`,
              phone,
              accounts: {
                create: {
                  type: "credentials",
                  provider: "phone",
                  providerAccountId: phone,
                },
              },
            },
          });
        } catch {
          user = await prisma.user.findFirst({
            where: { accounts: { some: { provider: "phone", providerAccountId: phone } } },
          });
        }
      }

      if (!user) {
        return null;
      }

      if (!user.phone) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { phone },
        });
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        phone: user.phone,
      };
    },
  });
}

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    phone?: string | null;
  }

  interface Session {
    user: {
      id: string;
      phone?: string | null;
    } & NonNullable<DefaultSession["user"]>;
  }
}

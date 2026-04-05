import NextAuth from "next-auth";
import authConfig from "@/auth.config";

export default NextAuth({
  ...authConfig,
  callbacks: {
    ...(authConfig.callbacks ?? {}),
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      if (path.startsWith("/dashboard")) {
        return !!auth?.user;
      }
      if (path.startsWith("/me")) {
        return !!auth?.user;
      }
      if (/^\/projects\/[^/]+\/claim\/?$/.test(path)) {
        return !!auth?.user;
      }
      if (path.startsWith("/admin")) {
        return !!auth?.user;
      }
      return true;
    },
  },
}).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/me/:path*", "/projects/:slug/claim", "/admin/:path*"],
};

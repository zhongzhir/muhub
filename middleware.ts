import NextAuth from "next-auth";
import authConfig from "@/auth.config";

export default NextAuth({
  ...authConfig,
  callbacks: {
    ...(authConfig.callbacks ?? {}),
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const protectedRoute =
        path.startsWith("/dashboard") ||
        path.startsWith("/me") ||
        path.startsWith("/settings") ||
        /^\/projects\/[^/]+\/claim\/?$/.test(path) ||
        path.startsWith("/admin");

      if (!auth?.user && protectedRoute) {
        const redirectPath = `${nextUrl.pathname}${nextUrl.search}`;
        const loginUrl = new URL("/login", nextUrl.origin);
        loginUrl.searchParams.set("redirect", redirectPath);
        return Response.redirect(loginUrl);
      }

      if (path.startsWith("/dashboard")) {
        return true;
      }
      if (path.startsWith("/me")) {
        return true;
      }
      if (path.startsWith("/settings")) {
        return true;
      }
      if (/^\/projects\/[^/]+\/claim\/?$/.test(path)) {
        return true;
      }
      if (path.startsWith("/admin")) {
        return true;
      }
      return true;
    },
  },
}).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/me/:path*", "/settings/:path*", "/projects/:slug/claim", "/admin/:path*"],
};

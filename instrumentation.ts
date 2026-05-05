import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Next.js 15 服务端请求错误钩子：
 * 所有服务端 API 路由、Server Action、Server Component 的未捕获异常
 * 会经由此钩子自动上报到 Sentry。
 */
export const onRequestError = Sentry.captureRequestError;

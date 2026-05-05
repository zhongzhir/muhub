import * as Sentry from "@sentry/nextjs";

/**
 * Next.js 15 客户端 instrumentation 入口（替代 sentry.client.config.ts）
 * 参考：https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",

  // 生产环境采样 10% 的性能追踪，开发环境 100%
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session Replay：正常录制 0%，出错时录制 100%
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // 开发环境可临时设为 true 查看 Sentry 初始化日志
  debug: false,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// 追踪客户端路由导航（Next.js 15 App Router）
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

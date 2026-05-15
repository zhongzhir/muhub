import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// HSTS 只在 HTTPS 环境生效；本地 HTTP 开发时不注入，避免浏览器锁定 HTTP origin
const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ?? false;

/**
 * Content-Security-Policy
 *
 * 策略说明：
 *  - script-src 'unsafe-inline'  : Next.js App Router 水合脚本需要，后续可用 nonce 收紧
 *  - script-src 'unsafe-eval'    : 仅开发环境需要（热重载）；生产构建已不需要但保留兼容
 *  - img-src https:              : 允许 GitHub 头像等外部图片
 *  - connect-src 'self'          : 所有外部 API 调用均在服务端，浏览器只需请求自身
 *  - frame-ancestors 'self'      : 防 Clickjacking，允许同源 iframe（分享名片嵌入场景）
 *  - form-action 'self' https://github.com : GitHub OAuth 重定向
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://github.com",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  // 防止 MIME 类型嗅探攻击
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 防 Clickjacking（与 CSP frame-ancestors 双保险）
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // 控制 Referer 信息泄露
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 限制不需要的浏览器权限
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // CSP
  { key: "Content-Security-Policy", value: csp },
  // HSTS：仅 HTTPS 环境注入（本地 HTTP 开发不注入，避免锁定）
  ...(isHttps
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // StrictMode 双挂载 + React 19 + SessionProvider 会在 E2E/`next start` 下触发 useInsertionEffect 报错
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      // 安全响应头：覆盖所有路由
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // 实训 PWA Service Worker（scope /，仅 training 子域注册）
      {
        source: "/training/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // 未配置 SENTRY_AUTH_TOKEN 时禁用 Source Maps 上传（捕获错误功能不受影响）
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  // 扩大客户端文件上传覆盖，确保所有 chunk 都有 Source Maps
  widenClientFileUpload: true,
  // 禁用 Sentry Telemetry
  telemetry: false,
  webpack: {
    // 禁用 Sentry 调试日志（替代已废弃的 disableLogger）
    treeshake: { removeDebugLogging: true },
    // 不自动创建 Vercel Cron Monitor（替代已废弃的 automaticVercelMonitors）
    automaticVercelMonitors: false,
  },
});

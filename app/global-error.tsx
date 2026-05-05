"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Next.js 根布局错误边界（global-error）
 *
 * 捕获根布局（app/layout.tsx）本身抛出的未处理错误，
 * 并通过 Sentry.captureException 上报。
 * 注意：此文件会替换整个 <html> 根节点，须包含完整 HTML 骨架。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="zh">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#ededed",
          margin: 0,
          gap: "1rem",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          出了点问题
        </h2>
        <p style={{ color: "#888", margin: 0, fontSize: "0.95rem" }}>
          页面遇到了意外错误，已自动上报。
        </p>
        {error.digest && (
          <p style={{ color: "#555", fontSize: "0.8rem", margin: 0 }}>
            错误 ID：{error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.375rem",
            border: "1px solid #333",
            background: "transparent",
            color: "#ededed",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          重试
        </button>
      </body>
    </html>
  );
}

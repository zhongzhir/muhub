"use client";

import { useEffect } from "react";

import { isTrainingHost } from "@/lib/pwa/training-host";

/**
 * 仅在 production 且 training 子域注册 /training/sw.js；失败静默。
 */
export function TrainingServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (!isTrainingHost(window.location.hostname)) return;

    async function setupTrainingServiceWorker() {
      try {
        // 先清理旧 training cache，减少旧首页继续命中的机会。
        if ("caches" in window) {
          const keys = await window.caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("muhub-training-")).map((key) => window.caches.delete(key)));
        }

        const registration = await navigator.serviceWorker.register("/training/sw.js", { scope: "/" });
        await registration.update();
      } catch {
        /* 失败静默，不影响页面 */
      }
    }

    void setupTrainingServiceWorker();
  }, []);

  return null;
}

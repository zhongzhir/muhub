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

    void navigator.serviceWorker.register("/training/sw.js", { scope: "/" }).catch(() => {});
  }, []);

  return null;
}

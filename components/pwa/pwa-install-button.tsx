"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Chromium 系：捕获 beforeinstallprompt 后显示低调「添加到桌面」入口；不支持则完全不渲染。
 */
export function PwaInstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const onInstallClick = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* 用户取消或环境异常 */
    }
    setDeferred(null);
  }, [deferred]);

  if (!deferred) {
    return null;
  }

  return (
    <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
      <span className="leading-relaxed">可添加到手机桌面，像应用一样打开。</span>
      <button
        type="button"
        onClick={onInstallClick}
        className="ml-2 font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
      >
        添加到桌面
      </button>
    </p>
  );
}

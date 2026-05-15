import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";

import { PwaInstallButton } from "@/components/pwa/pwa-install-button";
import { TrainingServiceWorkerRegister } from "@/components/pwa/training-service-worker-register";
import { isTrainingHost } from "@/lib/pwa/training-host";

const TRAINING_MANIFEST = "/training/manifest.webmanifest";

/** 与主站 PWA 相同：`public/icons/*` + 根目录 `apple-touch-icon.png`（pnpm pwa:icons 同步） */
const SITE_PWA_ICONS = {
  icon192: "/icons/icon-192.png",
  icon512: "/icons/icon-512.png",
  appleTouch: "/apple-touch-icon.png",
} as const;

async function getHost(): Promise<string> {
  return (await headers()).get("host") ?? "";
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await getHost();
  if (!isTrainingHost(host)) {
    return {};
  }

  return {
    applicationName: "MUHUB 实训平台",
    manifest: TRAINING_MANIFEST,
    themeColor: "#000000",
    appleWebApp: {
      capable: true,
      title: "MUHUB Training",
      statusBarStyle: "black-translucent",
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
    icons: {
      icon: [
        { url: SITE_PWA_ICONS.icon192, type: "image/png", sizes: "192x192" },
        { url: SITE_PWA_ICONS.icon512, type: "image/png", sizes: "512x512" },
      ],
      apple: [{ url: SITE_PWA_ICONS.appleTouch, sizes: "180x180", type: "image/png" }],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const host = await getHost();
  if (!isTrainingHost(host)) {
    return {};
  }

  return {
    themeColor: "#000000",
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

export default async function TrainingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = await getHost();
  const pwa = isTrainingHost(host);

  return (
    <>
      {children}
      {pwa ? (
        <>
          <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
            <PwaInstallButton />
          </div>
          <TrainingServiceWorkerRegister />
        </>
      ) : null}
    </>
  );
}

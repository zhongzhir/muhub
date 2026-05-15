import { headers } from "next/headers";
import type { Metadata, Viewport } from "next";

import { PwaInstallButton } from "@/components/pwa/pwa-install-button";
import { TrainingServiceWorkerRegister } from "@/components/pwa/training-service-worker-register";
import { isTrainingHost } from "@/lib/pwa/training-host";

const TRAINING_MANIFEST = "/training/manifest.webmanifest";
const TRAINING_ICONS = {
  icon192: "/training/icons/icon-192.png",
  icon512: "/training/icons/icon-512.png",
  appleTouch: "/training/icons/apple-touch-icon.png",
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
        { url: TRAINING_ICONS.icon192, type: "image/png", sizes: "192x192" },
        { url: TRAINING_ICONS.icon512, type: "image/png", sizes: "512x512" },
      ],
      apple: [{ url: TRAINING_ICONS.appleTouch, sizes: "180x180", type: "image/png" }],
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

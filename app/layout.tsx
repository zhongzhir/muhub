import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/header";
import { SiteFooter } from "@/components/footer";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  KEYWORDS,
  OG_DESCRIPTION,
  OG_TITLE,
  SITE_NAME_EN,
  SITE_NAME_ZH,
  SITE_URL,
  absoluteUrl,
} from "@/lib/seo/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const metadataBase = new URL(SITE_URL);

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase,
  applicationName: `${SITE_NAME_ZH} ${SITE_NAME_EN}`,
  title: {
    default: DEFAULT_TITLE,
    template: `%s - ${SITE_NAME_ZH} ${SITE_NAME_EN}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: KEYWORDS,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: `${SITE_NAME_ZH} ${SITE_NAME_EN}`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: absoluteUrl("/og-default.png"),
        width: 1200,
        height: 630,
        alt: OG_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [absoluteUrl("/og-default.png")],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "MUHUB",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/pwa/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/pwa/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SiteHeader />
        {children}
        <SiteFooter />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

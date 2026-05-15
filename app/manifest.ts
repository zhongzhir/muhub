import type { MetadataRoute } from "next";

/**
 * 主站 manifest：browser 模式，不触发「安装应用」。
 * 实训 PWA 使用 /training/manifest.webmanifest（仅 training 子域注入 link）。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MUHUB",
    short_name: "MUHUB",
    description: "AI时代的项目与创意协作平台",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#000000",
  };
}

/**
 * 将 `public/icons/*` 同步到 `public/pwa/*` 与根目录 `apple-touch-icon.png`（不重新导出 PNG）。
 * 使用：pnpm pwa:icons
 */
import { copyFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const pwaDir = join(publicDir, "pwa");
const iconsDir = join(publicDir, "icons");

function main() {
  mkdirSync(pwaDir, { recursive: true });

  const pairs = [
    [join(iconsDir, "icon-192.png"), join(pwaDir, "icon-192.png")],
    [join(iconsDir, "icon-512.png"), join(pwaDir, "icon-512.png")],
    [join(iconsDir, "apple-touch-icon.png"), join(publicDir, "apple-touch-icon.png")],
  ];

  for (const [src, dest] of pairs) {
    if (!existsSync(src)) {
      console.error(`缺少源文件: ${src}`);
      process.exit(1);
    }
    copyFileSync(src, dest);
  }

  console.log("pwa:icons → 已从 public/icons 同步到 public/pwa 与 apple-touch-icon.png");
}

main();

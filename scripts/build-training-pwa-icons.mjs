/**
 * 从 public/brand/logo-icon.svg 生成实训 PWA 图标。
 * 运行: pnpm training:pwa:icons
 */
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "training", "icons");
const src = join(root, "public", "brand", "logo-icon.svg");

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  mkdirSync(outDir, { recursive: true });
  for (const { name, size } of sizes) {
    await sharp(src)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(join(outDir, name));
  }
  console.log("training:pwa:icons → public/training/icons/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

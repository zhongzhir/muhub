/**
 * 从 public/brand 下已有 SVG 导出生成 PNG（栅格化，不修改图形）。
 * 用法: node scripts/export_brand_png.mjs
 */
import sharp from "sharp";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brand = join(__dirname, "../public/brand");

// Header ~40px 高，导出约 3× 便于高分屏
await sharp(join(brand, "logo-horizontal.svg"))
  .resize({ height: 160 })
  .png()
  .toFile(join(brand, "logo-horizontal.png"));

// Hero 96–140px 档，导出更大以便 srcset/缩放清晰
await sharp(join(brand, "logo-mark.svg"))
  .resize(320, 320)
  .png()
  .toFile(join(brand, "logo-mark.png"));

await sharp(join(brand, "logo-icon.svg"))
  .resize(192, 192)
  .png()
  .toFile(join(brand, "logo-icon.png"));

console.log("Wrote logo-horizontal.png, logo-mark.png, logo-icon.png");

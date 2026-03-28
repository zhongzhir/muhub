/**
 * PWA / Apple Touch 图标 —— 仅本地手动生成，不会在 `pnpm build` 中执行。
 *
 * 默认：`public/brand/logo-icon.svg`（与站头/品牌一致的方形图标源，等比居中、白底留白，避免拉伸变形）。
 * 若团队已有人工导出的 PNG，可将 `sourcePath` 改为该 PNG 路径后再运行。
 *
 * 使用：pnpm pwa:icons
 */
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const pwaDir = join(publicDir, "pwa");
const iconsDir = join(publicDir, "icons");

/** 人工确认的品牌方形图标源（SVG 或 PNG） */
const sourcePath = join(publicDir, "brand", "logo-icon.svg");

/**
 * 固定边长画布，内容上 contain 居中，不拉伸裁切主体。
 */
async function renderSquarePng(size, outFile) {
  await sharp(sourcePath, { density: 400 })
    .resize(size, size, {
      fit: "contain",
      position: "centre",
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toFile(outFile);
}

async function main() {
  mkdirSync(pwaDir, { recursive: true });
  mkdirSync(iconsDir, { recursive: true });

  await renderSquarePng(192, join(pwaDir, "icon-192.png"));
  await renderSquarePng(512, join(pwaDir, "icon-512.png"));
  await renderSquarePng(192, join(iconsDir, "icon-192.png"));
  await renderSquarePng(512, join(iconsDir, "icon-512.png"));
  await renderSquarePng(180, join(iconsDir, "apple-touch-icon.png"));
  await renderSquarePng(180, join(publicDir, "apple-touch-icon.png"));

  console.log(
    "pwa:icons → public/icons/*（manifest），public/pwa/*（兼容），public/apple-touch-icon.png",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * 从品牌 SVG 生成 PWA 尺寸 PNG（192 / 512 / maskable）与 Apple Touch Icon。
 * 运行: pnpm pwa:icons
 */
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const pwaDir = join(publicDir, "pwa");
const svgPath = join(publicDir, "brand", "logo-icon.svg");

async function paddedSquarePng(size, outSegments, innerRatio = 0.82) {
  const inner = Math.round(size * innerRatio);
  const pad = Math.round((size - inner) / 2);
  const iconBuf = await sharp(svgPath).resize(inner, inner).png().toBuffer();
  const outPath = join(publicDir, ...outSegments);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: iconBuf, left: pad, top: pad }])
    .png()
    .toFile(outPath);
}

async function main() {
  mkdirSync(pwaDir, { recursive: true });

  await sharp(svgPath).resize(192, 192).png().toFile(join(pwaDir, "icon-192.png"));
  await sharp(svgPath).resize(512, 512).png().toFile(join(pwaDir, "icon-512.png"));
  await paddedSquarePng(512, ["pwa", "icon-512-maskable.png"], 0.72);

  await paddedSquarePng(180, ["apple-touch-icon.png"], 0.78);

  console.log("pwa:icons → public/pwa/*.png, public/apple-touch-icon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

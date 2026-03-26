/**
 * 生成木哈布三套品牌 PNG（透明底、同一图形语言）。
 * 运行: node scripts/generate_muhub_brand_png.mjs
 */
import sharp from "sharp";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../public/brand");

const GRAD = `
<linearGradient id="muhubGrad" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="objectBoundingBox">
  <stop offset="0%" stop-color="#C43BEA"/>
  <stop offset="50%" stop-color="#3B82F6"/>
  <stop offset="100%" stop-color="#17C7C9"/>
</linearGradient>`;

/** 主标 / 横版图形：512 视图内几何 M（留白约 11%） */
function svgMarkFull() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <defs>${GRAD}</defs>
  <path fill="url(#muhubGrad)" d="
    M 104 396 L 104 116 L 152 116 L 256 268 L 360 116 L 408 116 L 408 396 L 352 396 L 352 188 L 256 312 L 160 188 L 160 396 Z
  "/>
</svg>`;
}

/** 图标版：同类几何，竖画加粗、内角抬高，利于 16–32px 辨认 */
function svgMarkIcon() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <defs>${GRAD}</defs>
  <path fill="url(#muhubGrad)" d="
    M 118 402 L 118 108 L 168 108 L 256 245 L 344 108 L 394 108 L 394 402 L 330 402 L 330 182 L 256 288 L 182 182 L 182 402 Z
  "/>
</svg>`;
}

/** 横版 720×180：左图形（比例 ~22% 宽）+ 右「木哈布」深灰字标 */
function svgHorizontal() {
  const markScale = 148 / 512;
  const gx = 24;
  const gy = Math.round((180 - 148) / 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="180" viewBox="0 0 720 180">
  <defs>${GRAD}</defs>
  <g transform="translate(${gx} ${gy}) scale(${markScale})">
    <path fill="url(#muhubGrad)" d="
      M 104 396 L 104 116 L 152 116 L 256 268 L 360 116 L 408 116 L 408 396 L 352 396 L 352 188 L 256 312 L 160 188 L 160 396 Z
    "/>
  </g>
  <text
    x="196"
    y="118"
    fill="#171717"
    font-family="system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif"
    font-size="68"
    font-weight="700"
    letter-spacing="-0.02em"
  >&#x6728;&#x54C8;&#x5E03;</text>
</svg>`;
}

await sharp(Buffer.from(svgHorizontal()))
  .png()
  .toFile(join(outDir, "muhub_logo_horizontal.png"));

await sharp(Buffer.from(svgMarkFull()))
  .png()
  .toFile(join(outDir, "muhub_logo_mark.png"));

await sharp(Buffer.from(svgMarkIcon()))
  .png()
  .toFile(join(outDir, "muhub_logo_icon.png"));

console.log("OK: muhub_logo_horizontal.png, muhub_logo_mark.png, muhub_logo_icon.png");

/**
 * 从单一成品 PNG 裁切生成 Header / Hero / PWA 用图（仅裁切与缩放，不重绘）。
 * 默认源：public/brand/incoming/a_logo_design_for_a_technology_related_brand_named.png
 * 或通过环境变量 BRAND_SOURCE_PNG、CLI 第一个参数指定路径。
 *
 * 横版：trim 后的整图；图形标：左侧 h×h（h 为横版图高度，适于「左图标 + 右字标」单行布局）。
 */
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brandDir = join(__dirname, "../public/brand");

const defaultIncoming = join(
  brandDir,
  "incoming/a_logo_design_for_a_technology_related_brand_named.png",
);

const sourcePath =
  process.argv[2] || process.env.BRAND_SOURCE_PNG || defaultIncoming;

if (!existsSync(sourcePath)) {
  console.error("找不到品牌源 PNG：", sourcePath);
  console.error("请将成品 PNG 放到上述路径，或传入：node scripts/slice_brand_from_source.mjs <path>");
  process.exit(1);
}

const trimmed = await sharp(sourcePath).trim({ threshold: 8 }).png().toBuffer();

const meta = await sharp(trimmed).metadata();
const w = meta.width ?? 0;
const h = meta.height ?? 0;

if (!w || !h) {
  console.error("无法读取源图尺寸");
  process.exit(1);
}

// 横版完整
await sharp(trimmed).png().toFile(join(brandDir, "logo-horizontal.png"));

// 左侧正方形图标区（单行横版：图标边长通常等于整图高度）
const iconSide = Math.min(h, w);
const markLeft = 0;
const markTop = 0;

await sharp(trimmed)
  .extract({ left: markLeft, top: markTop, width: iconSide, height: iconSide })
  .png()
  .toFile(join(brandDir, "logo-mark.png"));

await sharp(trimmed)
  .extract({ left: markLeft, top: markTop, width: iconSide, height: iconSide })
  .resize(192, 192, { fit: "fill" })
  .png()
  .toFile(join(brandDir, "logo-icon.png"));

console.log("已写入 public/brand/logo-horizontal.png, logo-mark.png, logo-icon.png");
console.log(`源尺寸( trim 后 ) ${w}×${h}，图形裁切 ${iconSide}×${iconSide}`);

/**
 * 生成 Beta SEO 所需静态资源：默认 OG 图、favicon、小尺寸 tab icon。
 * Apple Touch Icon / PWA 192·512 由 `pnpm pwa:icons` 单独维护，不在此脚本中覆盖。
 * 运行: pnpm seo:assets
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");
const brand = join(publicDir, "brand");

const markPath = join(brand, "muhub_logo_mark.png");
/** 与站点 / manifest 一致，由 `public/icons/icon-192.png` 缩放生成 tab icon 与 favicon.ico */
const iconSrc = join(publicDir, "icons", "icon-192.png");

async function main() {
  const ogWide = sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 244, g: 244, b: 245, alpha: 1 },
    },
  }).png();

  const markBuf = await sharp(markPath)
    .resize(520, 520, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  await ogWide
    .composite([{ input: markBuf, left: Math.round((1200 - 520) / 2), top: Math.round((630 - 520) / 2) }])
    .png()
    .toFile(join(publicDir, "og-default.png"));

  const icon32 = await sharp(iconSrc).resize(32, 32, { fit: "cover" }).png().toBuffer();
  const icon16 = await sharp(iconSrc).resize(16, 16, { fit: "cover" }).png().toBuffer();
  writeFileSync(join(publicDir, "icon.png"), icon32);

  const ico = await pngToIco([icon16, icon32]);
  writeFileSync(join(publicDir, "favicon.ico"), ico);

  console.log("seo:assets → og-default.png, icon.png, favicon.ico");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

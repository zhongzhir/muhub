import { createMobileCaptureItem } from "../lib/discovery/mobile-capture";

async function main() {
  const result = await createMobileCaptureItem({
    title: "测试公众号项目线索",
    content: "这是一篇测试文章 https://mp.weixin.qq.com/s/test-mobile-capture 里面提到一个 AI 项目。",
    sourceNote: "微信公众号",
  });

  console.log("创建是否成功:", true);
  console.log("itemId:", result.itemId);
  console.log("extractedUrl:", result.extractedUrl);
  console.log("isWechatArticle:", result.isWechatArticle);
  console.log("duplicate:", result.duplicate);
}

main().catch((error) => {
  console.error("创建是否成功:", false);
  console.error(error);
  process.exit(1);
});

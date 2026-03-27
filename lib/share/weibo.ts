/**
 * 微博网页分享（新开窗口）。文案、链接可由运营后续精调。
 */
export function buildWeiboShareUrl(pageUrl: string, titleOrSummary: string): string {
  const q = new URLSearchParams();
  q.set("url", pageUrl);
  q.set("title", titleOrSummary);
  return `https://service.weibo.com/share/share.php?${q.toString()}`;
}

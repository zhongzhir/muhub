/* MUHUB 最小 Service Worker：快速接管页面、请求一律走网络，避免陈旧离线缓存影响更新 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

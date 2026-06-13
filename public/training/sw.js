/* MUHUB 实训平台最小 Service Worker（仅 training 子域注册） */
const CACHE_NAME = "muhub-training-v2";

const PRECACHE_URLS = [
  "/training/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];
const PRECACHE_SET = new Set(PRECACHE_URLS);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => undefined),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isDocument =
    event.request.mode === "navigate" ||
    event.request.destination === "document";

  // 训练首页和其它 HTML 页面一律优先走网络，避免手机桌面入口长期命中旧页面。
  if (isDocument) {
    event.respondWith(fetch(event.request, { cache: "no-store" }));
    return;
  }

  // 仅对显式预缓存资源走 cache-first，其它资源全部直连网络。
  if (!PRECACHE_SET.has(url.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
